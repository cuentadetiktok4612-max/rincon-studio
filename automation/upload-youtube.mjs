// Sube a YouTube el vídeo que dejó generate-short.mjs en ../out y, solo si la subida salió bien,
// guarda la memoria de temas para que el próximo Short no repita idea.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMetadata, getAccessToken, uploadVideo } from './lib/youtube.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(path.resolve(HERE, '..'), 'out');
const STATE = path.join(HERE, 'state');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const readJson = async (f, fallback) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fallback; } };

async function main() {
  const meta = JSON.parse(await fs.readFile(path.join(OUT, 'metadata.json'), 'utf8'));
  const file = path.join(OUT, meta.videoFile);
  const buffer = await fs.readFile(file);
  const mime = file.endsWith('.webm') ? 'video/webm' : file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';

  const privacy = process.env.YT_PRIVACY || 'private';
  const body = buildMetadata(meta, {
    privacy,
    categoryId: process.env.YT_CATEGORY_ID || '27',
    synthetic: process.env.YT_SYNTHETIC || 'true',
    disclosure: process.env.YT_DISCLOSURE || '',
  });
  await fs.writeFile(path.join(OUT, 'youtube-request.json'), JSON.stringify(body, null, 2));
  log(`«${body.snippet.title}» · ${(buffer.length / 1048576).toFixed(1)} MB · privacidad solicitada: ${privacy}`);

  if (process.env.YT_DRY_RUN === '1') {
    log('Modo prueba: no se sube nada ni se guarda memoria de temas. Revisa out/youtube-request.json y el vídeo.');
    return;
  }

  const token = await getAccessToken({
    clientId: process.env.YT_CLIENT_ID,
    clientSecret: process.env.YT_CLIENT_SECRET,
    refreshToken: process.env.YT_REFRESH_TOKEN,
  });

  let lastPct = -1;
  const result = await uploadVideo({
    token, buffer, mime, body,
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastPct + 20) { lastPct = pct; log(`Subiendo… ${pct}%`); }
    },
  });
  if (!result?.id) throw new Error('YouTube respondió sin id de vídeo: ' + JSON.stringify(result).slice(0, 300));

  const url = `https://www.youtube.com/shorts/${result.id}`;
  log('Subido:', url, '| estado devuelto:', result.status?.privacyStatus || '?');

  // Memoria persistente (se confirma con commit en el workflow).
  const published = await readJson(path.join(STATE, 'published.json'), []);
  published.unshift({ id: result.id, topic: meta.topic, title: body.snippet.title, requestedPrivacy: privacy, at: new Date().toISOString() });
  await fs.writeFile(path.join(STATE, 'published.json'), JSON.stringify(published.slice(0, 200), null, 2) + '\n');
  for (const [from, to] of [['topic-memory.json', 'topics.json'], ['mascot.json', 'mascot.json']]) {
    try { await fs.copyFile(path.join(OUT, from), path.join(STATE, to)); } catch { /* no existe */ }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Short publicado\n\n**${body.snippet.title}**\n\n${url}\n\nPrivacidad solicitada: \`${privacy}\`\n`);
  }
}

main().catch((e) => { console.error('\nERROR:', e.message || e); process.exit(1); });
