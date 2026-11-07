// Señales de tendencia: Wikipedia (lo más leído), Google Trends (RSS), YouTube (más populares y Shorts que funcionan).
// Cada fuente falla por separado sin romper el análisis.
const UA = 'RinconStudio/29 (https://github.com; automatizacion personal de Shorts)';

async function getJson(fetchImpl, url, headers = {}) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function getText(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const decode = (s) => String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

// ---- Parsers puros (se prueban sin red) ----
export function parseWikipediaTop(json, limit = 25) {
  const BAD = /^(Portada|Main_Page|Pagina_principal|P[aá]gina_principal|-)$|^(Wikipedia|Especial|Special|Categor[ií]a|Category|Archivo|File|Anexo|Ayuda|Help|Talk|Discusi[oó]n|Portal|Plantilla|Template)[:_]/i;
  const arts = json?.items?.[0]?.articles || [];
  return arts.filter((a) => a?.article && !BAD.test(a.article) && !a.article.includes(':'))
    .slice(0, limit).map((a) => ({ text: a.article.replace(/_/g, ' '), metric: `${a.views} lecturas ayer` }));
}

export function parseTrendsRss(xml, limit = 15) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = /<title>([\s\S]*?)<\/title>/.exec(m[1]);
    const traffic = /<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/.exec(m[1]);
    if (title) out.push({ text: decode(title[1]), metric: traffic ? `${decode(traffic[1])} búsquedas` : '' });
    if (out.length >= limit) break;
  }
  return out;
}

export function parseIsoDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ''));
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// ---- Fuentes ----
export async function wikipediaTop(fetchImpl, lang, now = new Date()) {
  for (const back of [1, 2, 3]) {
    const d = new Date(now.getTime() - back * 86400000);
    const p = (n) => String(n).padStart(2, '0');
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia/all-access/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
    try {
      const items = parseWikipediaTop(await getJson(fetchImpl, url));
      if (items.length) return items;
    } catch { /* probar el día anterior (los datos tardan en publicarse) */ }
  }
  throw new Error('sin datos de Wikipedia');
}

export async function googleTrends(fetchImpl, geo) {
  return parseTrendsRss(await getText(fetchImpl, `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`));
}

export async function youtubePopular(fetchImpl, apiKey, region) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&maxResults=20&key=${encodeURIComponent(apiKey)}`;
  const j = await getJson(fetchImpl, url);
  return (j.items || []).map((v) => ({ text: v.snippet?.title || '', metric: `${v.statistics?.viewCount || '?'} vistas · ${v.snippet?.channelTitle || ''}` })).filter((x) => x.text);
}

// Shorts (≤60 s) recientes con más vistas para una consulta. Cuesta ~101 unidades de cuota de la API.
export async function scoutShorts(fetchImpl, apiKey, query, region, days = 7) {
  const after = new Date(Date.now() - days * 86400000).toISOString();
  const s = await getJson(fetchImpl, `https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoDuration=short&order=viewCount&maxResults=25&regionCode=${region}&relevanceLanguage=es&publishedAfter=${encodeURIComponent(after)}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`);
  const ids = (s.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const v = await getJson(fetchImpl, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${encodeURIComponent(apiKey)}`);
  return (v.items || [])
    .filter((x) => { const d = parseIsoDuration(x.contentDetails?.duration); return d > 0 && d <= 60; })
    .map((x) => ({ text: x.snippet?.title || '', views: +x.statistics?.viewCount || 0, channel: x.snippet?.channelTitle || '' }))
    .sort((a, b) => b.views - a.views).slice(0, 6)
    .map((x) => ({ text: x.text, metric: `Short con ${x.views} vistas esta semana · ${x.channel}` }));
}

// Reúne todo con ids S1..Sn para que el modelo cite evidencia verificable.
export async function collectSignals({ config, apiKey, scoutQueries = [], fetchImpl = fetch, now = new Date() }) {
  const errors = [];
  const tasks = [
    ['Wikipedia ES', () => wikipediaTop(fetchImpl, 'es', now)],
    ['Wikipedia EN', () => wikipediaTop(fetchImpl, 'en', now)],
    ...config.regions.slice(0, 3).map((g) => [`Google Trends ${g}`, () => googleTrends(fetchImpl, g)]),
  ];
  if (apiKey) {
    tasks.push(...config.regions.slice(0, 2).map((r) => [`YouTube populares ${r}`, () => youtubePopular(fetchImpl, apiKey, r)]));
    if (config.trendSearch?.enabled) {
      for (const q of scoutQueries.slice(0, config.trendSearch.maxQueries ?? 3)) {
        tasks.push([`Shorts de «${q}»`, () => scoutShorts(fetchImpl, apiKey, q, config.regions[0])]);
      }
    }
  }
  const results = await Promise.all(tasks.map(async ([source, fn]) => {
    try { return { source, items: await fn() }; } catch (e) { errors.push(`${source}: ${e.message}`); return { source, items: [] }; }
  }));
  const signals = [];
  for (const { source, items } of results) {
    for (const it of items.slice(0, source.startsWith('Shorts') ? 6 : 15)) signals.push({ id: `S${signals.length + 1}`, source, text: it.text.slice(0, 140), metric: it.metric });
  }
  return { signals, errors, sources: results.map((r) => `${r.source}: ${r.items.length}`) };
}
