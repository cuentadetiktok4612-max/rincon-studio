// Aprende de tus propios resultados: vistas por día por nicho (solo vídeos públicos; la API con clave no ve los privados).
export async function fetchVideoStats(fetchImpl, apiKey, ids) {
  const stats = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetchImpl(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const v of (await res.json()).items || []) stats[v.id] = { views: +v.statistics?.viewCount || 0, likes: +v.statistics?.likeCount || 0, comments: +v.statistics?.commentCount || 0 };
  }
  return stats;
}

// Devuelve { byNiche: {id:{n, viewsPerDay, multiplier}}, overall } con multiplicador acotado [0.6, 1.8].
export function computeNichePerformance(published, stats, now = Date.now()) {
  const rows = [];
  for (const p of published || []) {
    const s = stats?.[p.id];
    const ageDays = (now - Date.parse(p.at)) / 86400000;
    if (!s || !p.categoryId || !(ageDays >= 1)) continue;
    rows.push({ cat: p.categoryId, vpd: s.views / ageDays });
  }
  if (!rows.length) return { byNiche: {}, overall: 0 };
  const overall = rows.reduce((a, r) => a + r.vpd, 0) / rows.length;
  const byNiche = {};
  for (const cat of new Set(rows.map((r) => r.cat))) {
    const mine = rows.filter((r) => r.cat === cat);
    const vpd = mine.reduce((a, r) => a + r.vpd, 0) / mine.length;
    const raw = overall > 0 ? vpd / overall : 1;
    byNiche[cat] = { n: mine.length, viewsPerDay: +vpd.toFixed(2), multiplier: mine.length >= 2 ? Math.min(1.8, Math.max(0.6, raw)) : 1 };
  }
  return { byNiche, overall: +overall.toFixed(2) };
}
