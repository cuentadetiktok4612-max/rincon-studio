// Analiza tendencias, elige nicho y tema, y deja el plan en ../out/topic-plan.json. Nunca hace fallar el job:
// si algo sale mal, usa un nicho elegido por prioridad y la app propone el tema por su cuenta.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSignals } from './lib/trends.mjs';
import { fetchVideoStats, computeNichePerformance } from './lib/performance.mjs';
import { nichePrior, buildSelectorPrompt, callGemini, parseJsonLoose, scoreCandidates, choose, fallbackPlan } from './lib/planner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(path.resolve(HERE, '..'), 'out');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const readJson = async (f, fb) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fb; } };

async function main() {
  const config = await readJson(path.join(HERE, 'config', 'channel.json'), null);
  if (!config) throw new Error('falta automation/config/channel.json');
  const published = await readJson(path.join(HERE, 'state', 'published.json'), []);
  const topics = await readJson(path.join(HERE, 'state', 'topics.json'), []);
  const recentTopics = [...published.map((p) => p.topic), ...(Array.isArray(topics) ? topics : [])].filter(Boolean).slice(0, 80);
  const ytKey = process.env.YT_API_KEY || '';
  const rng = Math.random;

  // 1) Rendimiento propio (solo si hay clave y vídeos públicos con más de un día)
  let perf = { byNiche: {}, overall: 0 };
  if (ytKey && published.length) {
    try {
      const stats = await fetchVideoStats(fetch, ytKey, published.map((p) => p.id).filter(Boolean));
      perf = computeNichePerformance(published, stats);
      log('Rendimiento propio:', JSON.stringify(perf.byNiche) || '{}');
    } catch (e) { log('AVISO: no se pudo leer el rendimiento propio:', e.message); }
  }

  // 2) Prioridad de nichos y señales de tendencia
  const prior = nichePrior(config, published, perf, config.recentWindow ?? 5);
  const top = Object.entries(prior).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const scoutQueries = top.slice(0, config.trendSearch?.maxQueries ?? 3).map((c) => {
    const seeds = config.niches[c].seeds; return seeds[Math.floor(rng() * seeds.length)];
  });
  const { signals, errors, sources } = await collectSignals({ config, apiKey: ytKey, scoutQueries });
  log('Señales:', sources.join(' | '));
  for (const e of errors) log('AVISO fuente:', e);

  // 3) Candidatos puntuados + decisión
  let plan = null, candidates = [], note = '';
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = buildSelectorPrompt({ config, signals, prior, recentTopics, perf });
      const { text, model } = await callGemini({ prompt, key: geminiKey });
      const explore = rng() < (config.explorationRate ?? 0.2);
      candidates = scoreCandidates(parseJsonLoose(text), { validCats: new Set(Object.keys(config.niches)), signals, recentTopics, prior, explore });
      const best = choose(candidates);
      if (best) {
        plan = { ...best, mode: explore ? 'exploración' : 'tendencias', model };
        note = explore ? 'exploración: se ignoró la prioridad de nichos' : '';
      } else note = 'ningún candidato superó los filtros';
    } catch (e) { note = 'el selector falló: ' + e.message; }
  } else note = 'sin GEMINI_API_KEY';
  if (!plan) { plan = fallbackPlan(prior, rng); log('AVISO:', note, '→ nicho por prioridad:', plan.categoryId); }

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'topic-plan.json'), JSON.stringify({
    plan, note, generatedAt: new Date().toISOString(), prior, perf,
    signalsUsed: signals.length, sourceErrors: errors,
    candidates: candidates.map(({ categoryId, topic, final, base, factor, scores, rejected, evidence }) => ({ categoryId, topic, final, base, factor, scores, rejected, evidence })),
  }, null, 2));

  for (const c of [...candidates].sort((a, b) => b.final - a.final)) {
    log(`${c.rejected ? '✗' : '·'} ${c.final.toFixed(2)} [${c.categoryId}] ${c.topic}${c.rejected ? '  (' + c.rejected + ')' : ''}`);
  }
  log(`ELEGIDO (${plan.mode}): [${plan.categoryId}] ${plan.topic || '(la app propone el tema)'}`);
  if (process.env.GITHUB_STEP_SUMMARY && plan.topic) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Tema elegido\n\n**${plan.topic}** · \`${plan.categoryId}\` · ${plan.mode}\n\n${plan.why || ''}\n\n`);
  }
}

main().catch((e) => { console.error('AVISO: el análisis de tendencias falló, se continúa sin plan:', e.message); process.exit(0); });
