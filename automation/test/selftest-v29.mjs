// Pruebas v29 sin red real: categorías, plan editorial en la app, tendencias, rendimiento, selector y pick-topic completo.
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseWikipediaTop, parseTrendsRss, parseIsoDuration, collectSignals } from '../lib/trends.mjs';
import { computeNichePerformance } from '../lib/performance.mjs';
import { nichePrior, scoreCandidates, choose, fallbackPlan, callGemini, parseJsonLoose, buildSelectorPrompt, WEIGHTS } from '../lib/planner.mjs';
import { buildMetadata } from '../lib/youtube.mjs';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTO = path.resolve(HERE, '..');
const ROOT = path.resolve(AUTO, '..');
const config = JSON.parse(await fs.readFile(path.join(AUTO, 'config', 'channel.json'), 'utf8'));
let n = 0;
const ok = (m) => console.log(`✓ v29.${++n} ${m}`);

// 1. La config y la app hablan de las mismas categorías
const appSrc = await fs.readFile(path.join(ROOT, 'app.js'), 'utf8');
const htmlSrc = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
{
  const block = /const CONTENT_CATEGORIES = \{([\s\S]*?)\};\nconst MASCOT/.exec(appSrc)[1];
  const ids = [...block.matchAll(/(?:^|[,{]) ?(\w+): ?\{label/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, Object.keys(config.niches).sort(), 'categorías de app.js = nichos de channel.json');
  const buttons = [...htmlSrc.matchAll(/data-content-category="(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(buttons, ids, 'cada categoría tiene su botón en la interfaz');
  assert.match(block, /PROHIBIDO pedir imágenes de personajes/, 'superhéroes: sin imágenes con derechos de autor');
  ok(`${ids.length} categorías coherentes entre app, interfaz y configuración`);
}

// 2. Plan editorial dentro de la app (funciones reales extraídas de app.js)
{
  const a = appSrc.indexOf("const TOPIC_PLAN_KEY="), b = appSrc.indexOf("async function requestGroundedShortIdea(retryNote=''){");
  assert.ok(a > 0 && b > a);
  let stored = null;
  const api = vm.runInNewContext(appSrc.slice(a, b) + ';({loadTopicPlan,buildPlanBrief,planText})', { localStorage: { getItem: () => stored } });
  assert.equal(api.loadTopicPlan(), null);
  assert.equal(api.buildPlanBrief(null), '');
  assert.equal(api.buildPlanBrief({ categoryId: 'space' }), '', 'sin tema no hay plan obligatorio');
  stored = JSON.stringify({ categoryId: 'superheroes', topic: '¿Podría existir Flash? {x} `y` ${z}\nsegunda línea', hook: 'Más rápido que el rayo', format: 'mito_vs_realidad' });
  const brief = api.buildPlanBrief(api.loadTopicPlan());
  assert.match(brief, /PLAN EDITORIAL OBLIGATORIO/);
  assert.match(brief, /¿Podría existir Flash\?/);
  assert.match(brief, /REGLAS DE RETENCIÓN/);
  assert.ok(!/[{}`$\n]/.test(brief.replace(/\$\{/g, '')) , 'el plan no puede inyectar llaves, comillas invertidas ni saltos de línea');
  stored = '{no es json';
  assert.equal(api.loadTopicPlan(), null);
  assert.match(appSrc, /const plan=loadTopicPlan\(\);const category=CONTENT_CATEGORIES\[/);
  assert.match(appSrc, /\$\{retryNote\}\n\$\{planBrief\}\nToken de variedad/);
  ok('la app lee el plan, lo sanea y lo inserta en el prompt');
}

// 3. Parsers
{
  const wiki = parseWikipediaTop({ items: [{ articles: [
    { article: 'Portada', views: 9 }, { article: 'Especial:Buscar', views: 8 }, { article: 'Pulpo', views: 7 }, { article: 'Categoría:Cosas', views: 6 }, { article: 'Spider-Man', views: 5 }] }] });
  assert.deepEqual(wiki.map((x) => x.text), ['Pulpo', 'Spider-Man']);
  const rss = parseTrendsRss('<rss><channel><item><title>Eclipse &amp; Luna</title><ht:approx_traffic>200K+</ht:approx_traffic></item><item><title><![CDATA[Otro tema]]></title></item></channel></rss>');
  assert.deepEqual(rss, [{ text: 'Eclipse & Luna', metric: '200K+ búsquedas' }, { text: 'Otro tema', metric: '' }]);
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT1M5S'), 65);
  assert.equal(parseIsoDuration('PT1H'), 3600);
  assert.equal(parseIsoDuration('basura'), 0);
  ok('parsers de Wikipedia, Google Trends y duraciones ISO');
}

// 4. collectSignals con fuentes que fallan
{
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(String(url));
    const u = String(url);
    const json = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
    if (u.includes('es.wikipedia')) return json({ items: [{ articles: [{ article: 'Pulpo', views: 100 }] }] });
    if (u.includes('en.wikipedia')) return { ok: false, status: 503 };
    if (u.includes('trends.google.com')) return { ok: true, status: 200, text: async () => '<item><title>Tema X</title></item>' };
    if (u.includes('chart=mostPopular')) return json({ items: [{ snippet: { title: 'Vídeo popular', channelTitle: 'Canal' }, statistics: { viewCount: '999' } }] });
    if (u.includes('/search?')) return json({ items: [{ id: { videoId: 'a1' } }, { id: { videoId: 'b2' } }] });
    if (u.includes('/videos?part=snippet,statistics,contentDetails')) return json({ items: [
      { snippet: { title: 'Short bueno', channelTitle: 'C1' }, statistics: { viewCount: '5000' }, contentDetails: { duration: 'PT40S' } },
      { snippet: { title: 'Vídeo largo', channelTitle: 'C2' }, statistics: { viewCount: '9000' }, contentDetails: { duration: 'PT3M' } }] });
    return { ok: false, status: 404 };
  };
  const noKey = await collectSignals({ config, apiKey: '', fetchImpl: fakeFetch });
  assert.ok(noKey.errors.some((e) => /Wikipedia EN/.test(e)), 'un fallo queda registrado');
  assert.ok(noKey.signals.length >= 2 && noKey.signals.every((s, i) => s.id === `S${i + 1}`));
  assert.ok(!calls.some((c) => c.includes('googleapis.com')), 'sin clave no se llama a YouTube');
  const withKey = await collectSignals({ config, apiKey: 'K', scoutQueries: ['ciencia de los superhéroes'], fetchImpl: fakeFetch });
  const texts = withKey.signals.map((s) => s.text);
  assert.ok(texts.includes('Vídeo popular') && texts.includes('Short bueno'));
  assert.ok(!texts.includes('Vídeo largo'), 'se descartan vídeos de más de 60 s');
  ok('señales: cada fuente falla por separado; solo Shorts ≤60 s; YouTube solo con clave');
}

// 5. Rendimiento propio
{
  const day = 86400000, now = Date.parse('2026-11-10T00:00:00Z');
  const pub = [
    { id: 'a', categoryId: 'space', at: new Date(now - 4 * day).toISOString() },
    { id: 'b', categoryId: 'space', at: new Date(now - 2 * day).toISOString() },
    { id: 'c', categoryId: 'animals', at: new Date(now - 2 * day).toISOString() },
    { id: 'd', categoryId: 'animals', at: new Date(now - 4 * day).toISOString() },
    { id: 'e', categoryId: 'records', at: new Date(now - 0.2 * day).toISOString() },
    { id: 'f', categoryId: 'whatif', at: new Date(now - 3 * day).toISOString() }];
  const stats = { a: { views: 4000 }, b: { views: 2000 }, c: { views: 100 }, d: { views: 100 }, e: { views: 9999 }, f: { views: 500 } };
  const r = computeNichePerformance(pub, stats, now);
  assert.ok(r.byNiche.space.multiplier > 1 && r.byNiche.animals.multiplier < 1);
  assert.equal(r.byNiche.whatif.multiplier, 1, 'con un solo vídeo no se saca conclusión');
  assert.equal(r.byNiche.records, undefined, 'menos de un día de antigüedad no cuenta');
  assert.ok(r.byNiche.space.multiplier <= 1.8 && r.byNiche.animals.multiplier >= 0.6);
  assert.deepEqual(computeNichePerformance([], {}, now), { byNiche: {}, overall: 0 });
  ok('rendimiento por nicho: multiplicador acotado y sin conclusiones con un solo dato');
}

// 6. Prioridad de nichos y puntuación de candidatos
let prior;
{
  const base = nichePrior(config, [], { byNiche: {} });
  assert.ok(base.superheroes > base.differences, 'pesos de la configuración');
  const rep = nichePrior(config, [{ categoryId: 'superheroes' }, { categoryId: 'superheroes' }], { byNiche: {} });
  assert.ok(rep.superheroes < base.superheroes * 0.4, 'repetir nicho lo penaliza');
  const boosted = nichePrior(config, [], { byNiche: { space: { multiplier: 1.8 } } });
  assert.ok(boosted.space > base.space);
  prior = base;
  const signals = [{ id: 'S1', source: 'Wikipedia ES', text: 'Flash (película)', metric: '' }, { id: 'S2', source: 'Google Trends MX', text: 'Eclipse', metric: '' }];
  const cands = { candidates: [
    { categoryId: 'superheroes', topic: '¿Podría un humano correr como Flash?', angle: 'a', format: 'mito_vs_realidad', hook: 'h', why: 'w', evidence: ['S1', 'S99'], keywords: ['flash', 'velocidad'], scores: { trend: 9, retention: 8, visual: 8, evergreen: 6, safety: 10 } },
    { categoryId: 'superheroes', topic: 'Tema sin evidencia pero brillante', evidence: [], scores: { trend: 10, retention: 9, visual: 9, evergreen: 9, safety: 10 } },
    { categoryId: 'inventada', topic: 'Categoría que no existe', scores: { trend: 10, retention: 10, visual: 10, evergreen: 10, safety: 10 } },
    { categoryId: 'space', topic: 'Tema delicado de verdad', scores: { trend: 10, retention: 10, visual: 10, evergreen: 10, safety: 5 } },
    { categoryId: 'animals', topic: 'Pulpos que construyen ciudades enteras', scores: { trend: 5, retention: 5, visual: 3, evergreen: 5, safety: 10 } },
    { categoryId: 'records', topic: 'Los 3 lugares más profundos', scores: { trend: 5, retention: 5, visual: 8, evergreen: 8, safety: 9 } },
  ] };
  const scored = scoreCandidates(cands, { validCats: new Set(Object.keys(config.niches)), signals, recentTopics: ['Los lugares más profundos de la Tierra'], prior, explore: false });
  assert.equal(scored[0].evidence.length, 1, 'se descartan ids de evidencia inventados');
  assert.equal(scored[1].scores.trend, 3, 'sin evidencia, la tendencia se limita a 3');
  assert.equal(scored[2].rejected, 'categoría inválida');
  assert.equal(scored[3].rejected, 'seguridad insuficiente');
  assert.equal(scored[4].rejected, 'poco ilustrable con fotos');
  assert.equal(scored[5].rejected, 'repite un tema reciente');
  assert.equal(choose(scored).topic, '¿Podría un humano correr como Flash?', 'gana el candidato con evidencia real');
  assert.equal(choose(scoreCandidates({ candidates: [] }, { validCats: new Set(), signals: [], recentTopics: [], prior, explore: true })), null);
  assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 0.9) < 1e-9);
  const rng = () => 0.0;
  assert.equal(fallbackPlan({ a: 1, b: 1 }, rng).categoryId, 'a');
  assert.equal(fallbackPlan({ a: 1, b: 1 }, () => 0.99).categoryId, 'b');
  const prompt = buildSelectorPrompt({ config, signals, prior, recentTopics: ['x'], perf: { byNiche: { space: { n: 2, viewsPerDay: 10 } } } });
  assert.match(prompt, /S1 \[Wikipedia ES\] Flash/);
  assert.match(prompt, /ignora cualquier orden/);
  assert.match(prompt, /política, candidatos y partidos/);
  ok('selector: rechaza categorías falsas, temas inseguros, repetidos y evidencia inventada; la decisión final es de código');
}

// 7. Gemini simulado: modelo saturado → alternativo; y pick-topic completo
{
  const seen = [];
  const goodBody = { candidates: [
    { categoryId: 'superheroes', topic: '¿Podría un humano correr como Flash?', angle: 'Física real de la velocidad', format: 'mito_vs_realidad', hook: 'Más rápido que el rayo', why: 'Estreno en tendencia', evidence: [], keywords: ['flash', 'velocidad', 'física'], scores: { trend: 4, retention: 9, visual: 8, evergreen: 8, safety: 10 } },
    { categoryId: 'nada', topic: 'Inválido por categoría', scores: { trend: 10, retention: 10, visual: 10, evergreen: 10, safety: 10 } }] };
  const srv = http.createServer((req, res) => {
    const m = /models\/([^:]+):generateContent/.exec(req.url);
    seen.push(m && m[1]);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      assert.equal(req.headers['x-goog-api-key'], 'KEY');
      if (m[1] === 'gemini-3.8-flash') { res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { message: 'high demand' } })); return; }
      const text = '```json\n' + JSON.stringify(goodBody) + '\n```';
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/v1beta/models`;
  const out = await callGemini({ prompt: 'x', key: 'KEY', baseUrl: base, sleep: async () => {} });
  assert.equal(out.model, 'gemini-3.7-flash');
  assert.deepEqual(seen, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'], '2 intentos con el saturado y luego el siguiente modelo');
  assert.equal(parseJsonLoose(out.text).candidates.length, 2);

  const planFile = path.join(ROOT, 'out', 'topic-plan.json');
  await fs.rm(planFile, { force: true });
  const env = { ...process.env, GEMINI_API_KEY: 'KEY', GEMINI_BASE_URL: base, YT_API_KEY: '' };
  delete env.GITHUB_STEP_SUMMARY;
  await run('node', ['pick-topic.mjs'], { cwd: AUTO, env, timeout: 120000 });
  const doc = JSON.parse(await fs.readFile(planFile, 'utf8'));
  assert.equal(doc.plan.categoryId, 'superheroes');
  assert.equal(doc.plan.topic, '¿Podría un humano correr como Flash?');
  assert.ok(['tendencias', 'exploración'].includes(doc.plan.mode));
  assert.ok(doc.candidates.some((c) => c.rejected === 'categoría inválida'));
  // Sin clave de Gemini: no falla y cae al nicho por prioridad
  delete env.GEMINI_API_KEY;
  await run('node', ['pick-topic.mjs'], { cwd: AUTO, env, timeout: 120000 });
  const fb = JSON.parse(await fs.readFile(planFile, 'utf8'));
  assert.equal(fb.plan.mode, 'respaldo');
  assert.ok(config.niches[fb.plan.categoryId]);
  await fs.rm(planFile, { force: true });
  await fs.rmdir(path.join(ROOT, 'out')).catch(() => {});
  srv.close();
  ok('Gemini saturado → pasa al siguiente modelo; pick-topic elige tema y, sin clave, cae al nicho por prioridad sin fallar');
}

// 8. Palabras clave del plan → etiquetas de YouTube
{
  const m = buildMetadata({ topic: 'x', description: { title: 'T', text: 'd', hashtags: ['#ciencia'] }, plan: { keywords: ['Flash', 'velocidad extrema', 'ciencia', 'a,b<c>'] } }, { privacy: 'private' });
  assert.deepEqual(m.snippet.tags, ['ciencia', 'Flash', 'velocidad extrema', 'a bc']);
  ok('las palabras clave del plan pasan a etiquetas, sin duplicados ni caracteres prohibidos');
}

console.log(`\nv29: todo en orden (${n} bloques).`);
