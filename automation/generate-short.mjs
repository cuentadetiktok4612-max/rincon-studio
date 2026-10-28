// Abre Rincón Studio en Chrome sin pantalla, pulsa «Generar y descargar Short» y deja el vídeo verificado en ../out.
// La app no se modifica: solo se le siembran las claves en localStorage, igual que si las pegaras en Ajustes.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './lib/static-server.mjs';
import { hasFfmpeg, checkVideo, normalizeForYouTube } from './lib/video.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'out');
const STATE = path.join(HERE, 'state');
const TIMEOUT_MIN = +process.env.GEN_TIMEOUT_MIN || 35;

const K = {
  app: 'focoshorts_studio_v1',
  gemini: 'focoshorts_key_gemini',
  groq: 'focoshorts_key_groq',
  pexels: 'focoshorts_image_pexels',
  pixabay: 'focoshorts_image_pixabay',
  topics: 'focoshorts_topic_memory_v2',
  mascot: 'focoshorts_mascot_profile_v1',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const readJson = async (f, fallback) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fallback; } };

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('Falta el secret GEMINI_API_KEY: la app lo necesita para investigar el tema, escribir el guion y generar la voz.');
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const topics = await readJson(path.join(STATE, 'topics.json'), []);
  const mascot = await readJson(path.join(STATE, 'mascot.json'), null);
  const seed = [
    [K.gemini, process.env.GEMINI_API_KEY, true],
    [K.groq, process.env.GROQ_API_KEY, true],
    [K.pexels, process.env.PEXELS_API_KEY, true],
    [K.pixabay, process.env.PIXABAY_API_KEY, true],
    [K.topics, Array.isArray(topics) ? JSON.stringify(topics) : null, true],
    [K.mascot, mascot && typeof mascot === 'object' ? JSON.stringify(mascot) : null, true],
  ].filter(([, v]) => v);

  const { port, close } = await startStaticServer(ROOT);
  const channel = process.env.PW_CHANNEL === 'chromium' ? undefined : (process.env.PW_CHANNEL || 'chrome');
  const browser = await chromium.launch({
    channel,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--no-sandbox',
    ],
  });
  log('Navegador:', browser.version());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.addInitScript((items) => {
    try { for (const [k, v] of items) localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
  }, seed.map(([k, v]) => [k, v]));
  const page = await context.newPage();

  let crashed = false;
  let saved = null;
  let suggested = '';
  page.on('crash', () => { crashed = true; });
  page.on('pageerror', (e) => log('pageerror:', String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error:', m.text().slice(0, 200)); });
  page.on('download', (d) => {
    suggested = d.suggestedFilename();
    const dest = path.join(OUT, 'raw-' + suggested);
    log('Descarga recibida:', suggested);
    saved = d.saveAs(dest).then(() => dest);
  });

  const seenToasts = new Set();
  const watchdog = setTimeout(() => { console.error('Tiempo máximo superado.'); process.exit(2); }, TIMEOUT_MIN * 60000);

  let failure = null;
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('#recentProjects .recent-item', { timeout: 60000 }); // la app terminó de iniciar
    log('App iniciada. Generando…');
    await page.click('#dashStart');
    await sleep(3000);

    let lastReport = 0;
    const started = Date.now();
    while (true) {
      if (crashed) throw new Error('La página de Chrome se cerró por falta de memoria o un fallo interno.');
      if (Date.now() - started > TIMEOUT_MIN * 60000) throw new Error('Tiempo agotado generando el Short.');
      const busy = await page.$eval('#dashStart', (b) => b.disabled).catch(() => true);
      const toasts = await page.$$eval('.toast', (els) => els.map((e) => e.className + '|' + e.textContent)).catch(() => []);
      for (const t of toasts) if (!seenToasts.has(t)) { seenToasts.add(t); log('aviso:', t.slice(0, 220)); }
      if (Date.now() - lastReport > 20000) {
        lastReport = Date.now();
        const label = await page.$eval('#dashStart', (b) => b.textContent).catch(() => '');
        const prog = await page.$eval('#videoProgressLabel', (e) => e.textContent).catch(() => '');
        log(`… ${label.trim()} ${prog ? '| ' + prog.trim() : ''}`);
      }
      if (!busy) break;
      await sleep(2000);
    }

    for (let i = 0; i < 60 && !saved; i++) await sleep(500);
    if (!saved) throw new Error('La app terminó sin descargar ningún vídeo.');
    const rawFile = await saved;

    const snap = await page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), [K.app, K.topics, K.mascot]);
    const state = JSON.parse(snap[K.app] || '{}');
    const project = (state.projects || []).find((p) => p.id === state.activeId) || (state.projects || [])[0];
    await fs.writeFile(path.join(OUT, 'activity.json'), JSON.stringify((state.activity || []).slice(0, 40), null, 2));
    if (!project) throw new Error('No se encontró el proyecto generado en el almacenamiento de la app.');
    if ((state.projects || []).length < 2) throw new Error('La app no creó un proyecto nuevo (solo existe el de ejemplo).');

    // Control de calidad del archivo antes de tocar YouTube.
    let finalFile = rawFile;
    if (await hasFfmpeg()) {
      const q = await checkVideo(rawFile, project.durationSec);
      log('Vídeo:', JSON.stringify({ ...q.info, volume: q.volume }));
      if (q.problems.length) throw new Error('El vídeo no pasó el control de calidad:\n- ' + q.problems.join('\n- '));
      finalFile = await normalizeForYouTube(rawFile, OUT, q.info);
    } else {
      log('AVISO: no hay ffmpeg/ffprobe; se omite el control de calidad del vídeo.');
    }

    const meta = {
      topic: project.topic,
      durationSec: project.durationSec,
      description: project.description,
      hook: project.hook?.text || '',
      facts: (project.facts || []).map((f) => ({ claim: f.claim, sourceName: f.sourceName, sourceUrl: f.sourceUrl })),
      videoFile: path.basename(finalFile),
      generatedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(OUT, 'metadata.json'), JSON.stringify(meta, null, 2));
    if (snap[K.topics]) await fs.writeFile(path.join(OUT, 'topic-memory.json'), snap[K.topics]);
    if (snap[K.mascot]) await fs.writeFile(path.join(OUT, 'mascot.json'), snap[K.mascot]);
    log(`Listo: «${project.topic}» · ${project.durationSec}s · ${meta.videoFile}`);
  } catch (e) {
    failure = e;
    try { await page.screenshot({ path: path.join(OUT, 'failure.png') }); } catch { /* sin captura */ }
    try {
      const act = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').activity?.slice(0, 15) || [], K.app);
      await fs.writeFile(path.join(OUT, 'activity.json'), JSON.stringify(act, null, 2));
      for (const a of act.slice(0, 6)) log('actividad:', a.message);
    } catch { /* página no disponible */ }
  } finally {
    clearTimeout(watchdog);
    await browser.close().catch(() => {});
    await close().catch(() => {});
  }
  if (failure) throw failure;
}

main().catch((e) => { console.error('\nERROR:', e.message || e); process.exit(1); });
