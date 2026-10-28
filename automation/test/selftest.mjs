// Pruebas sin red ni Chrome: servidor estático, control de calidad con ffmpeg, metadatos y subida reanudable contra un YouTube simulado.
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../lib/static-server.mjs';
import { hasFfmpeg, checkVideo, normalizeForYouTube, probe } from '../lib/video.mjs';
import { buildMetadata, getAccessToken, uploadVideo, YouTubeError } from '../lib/youtube.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rincon-test-'));
let n = 0;
const ok = (m) => console.log(`✓ ${++n}. ${m}`);

// 1. Servidor estático
{
  const s = await startStaticServer(ROOT);
  const get = (p) => fetch(`http://127.0.0.1:${s.port}${p}`);
  const idx = await get('/index.html');
  assert.equal(idx.status, 200);
  assert.match(idx.headers.get('content-type'), /text\/html/);
  assert.match((await get('/app.js')).headers.get('content-type'), /javascript/);
  assert.equal((await get('/assets/emo/saluda.png')).status, 200);
  assert.equal((await get('/nada.txt')).status, 404);
  const trav = await new Promise((resolve) => http.get({ host: '127.0.0.1', port: s.port, path: '/../../../etc/passwd' }, (r) => resolve(r.statusCode)));
  assert.ok([403, 404].includes(trav), 'path traversal bloqueado');
  await s.close();
  ok('servidor estático sirve la app y bloquea rutas fuera de la raíz');
}

// 2. Control de calidad + normalización
if (await hasFfmpeg()) {
  const mk = (name, args) => { const f = path.join(tmp, name); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, f]); return f; };
  const good = mk('good.webm', ['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000', '-t', '8', '-c:v', 'libvpx-vp9', '-b:v', '300k', '-c:a', 'libopus']);
  const q = await checkVideo(good, 8);
  assert.deepEqual(q.problems, [], 'vídeo bueno sin problemas: ' + q.problems);
  const norm = await normalizeForYouTube(good, tmp, q.info);
  const p2 = await probe(norm);
  assert.equal(p2.video.codec, 'h264');
  assert.equal(p2.audio.codec, 'aac');
  assert.equal(p2.video.pixFmt, 'yuv420p');
  assert.equal((await normalizeForYouTube(norm, tmp, p2)), norm, 'un MP4 H.264+AAC no se reencoda');
  ok('WebM VP9/Opus válido → MP4 H.264/AAC; un MP4 ya compatible se deja intacto');

  const silent = mk('silent.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
  assert.ok((await checkVideo(silent, 8)).problems.some((x) => /silencio/.test(x)));
  const noAudio = mk('noaudio.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
  assert.ok((await checkVideo(noAudio, 8)).problems.some((x) => /audio/.test(x)));
  const wide = mk('wide.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
  assert.ok((await checkVideo(wide, 8)).problems.some((x) => /vertical/.test(x)));
  assert.ok((await checkVideo(good, 30)).problems.some((x) => /no coincide/.test(x)));
  ok('el control detecta silencio, ausencia de audio, vídeo horizontal y duración incoherente');
} else {
  console.log('· ffmpeg no disponible: se omiten las pruebas de vídeo');
}

// 3. Metadatos
{
  const long = 'Línea de fuente con acentos ñ é ü — '.repeat(3) + '\n';
  const m = buildMetadata({
    topic: 'Tema',
    description: { title: '<b>' + 'T'.repeat(130) + '</b>', text: 'Intro <script>\n' + long.repeat(200), hashtags: ['#ciencia', 'Datos Curiosos', '#ciencia', '#Shorts'] },
  }, { privacy: 'public', disclosure: 'Hecho con IA.' });
  assert.ok(m.snippet.title.length <= 100 && !/[<>]/.test(m.snippet.title));
  assert.ok(Buffer.byteLength(m.snippet.description) <= 5000, 'descripción ≤ 5000 bytes');
  assert.ok(!/[<>]/.test(m.snippet.description));
  assert.match(m.snippet.description, /Hecho con IA\.\n#ciencia #Datos #Curiosos #Shorts$/);
  assert.equal(m.snippet.description.match(/#Shorts/g).length, 1);
  assert.equal(m.status.privacyStatus, 'public');
  assert.equal(m.status.containsSyntheticMedia, true);
  assert.equal(buildMetadata({ topic: 'x', description: {} }, { privacy: 'raro' }).status.privacyStatus, 'private', 'privacidad inválida → private');
  assert.equal('containsSyntheticMedia' in buildMetadata({ topic: 'x', description: {} }, { synthetic: 'omit' }).status, false);
  ok('metadatos: título ≤100, sin <>, descripción ≤5000 bytes, hashtags limpios, privacidad segura por defecto');
}

// 4. Subida reanudable contra un YouTube simulado (con un 503 a mitad de camino)
{
  const CH = 262144 * 2;
  const data = crypto.randomBytes(CH * 3 + 12345);
  const received = [];
  let got = 0, injected = false, sessionBody = null, tokenForm = null;
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/token') {
        tokenForm = new URLSearchParams(body.toString());
        if (tokenForm.get('refresh_token') === 'MALO') { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: 'AT123' })); return;
      }
      if (u.pathname === '/upload' && req.method === 'POST') {
        assert.equal(req.headers.authorization, 'Bearer AT123');
        assert.equal(req.headers['x-upload-content-length'], String(data.length));
        sessionBody = JSON.parse(body.toString());
        res.writeHead(200, { Location: `http://127.0.0.1:${srv.address().port}/session/1` }).end(); return;
      }
      if (u.pathname === '/session/1' && req.method === 'PUT') {
        const cr = req.headers['content-range'];
        const q = /^bytes \*\/(\d+)$/.exec(cr);
        if (q) { // consulta de progreso
          if (got === 0) { res.writeHead(308).end(); return; }
          res.writeHead(308, { Range: `bytes=0-${got - 1}` }).end(); return;
        }
        const [, s, e, t] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr).map(Number);
        assert.equal(s, got, 'el cliente reanuda exactamente donde quedó el servidor');
        if (s === CH && !injected) { injected = true; res.writeHead(503).end('boom'); return; }
        received.push(body); got = e + 1;
        if (got === t) { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 'VID42', status: { privacyStatus: 'private' } })); return; }
        res.writeHead(308, { Range: `bytes=0-${got - 1}` }).end(); return;
      }
      res.writeHead(404).end();
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  process.env.YT_TOKEN_URL = base + '/token';
  process.env.YT_UPLOAD_URL = base + '/upload';
  process.env.YT_CHUNK_BYTES = String(CH);

  const token = await getAccessToken({ clientId: 'cid', clientSecret: 'sec', refreshToken: 'RT' });
  assert.equal(token, 'AT123');
  assert.equal(tokenForm.get('grant_type'), 'refresh_token');
  await assert.rejects(getAccessToken({ clientId: 'cid', clientSecret: 'sec', refreshToken: 'MALO' }), (e) => e instanceof YouTubeError && /7 días/.test(e.message));

  const body = buildMetadata({ topic: 'Prueba', description: { title: 'Prueba', text: 'Texto', hashtags: ['#a'] } }, { privacy: 'private' });
  const t0 = Date.now();
  const result = await uploadVideo({ token, buffer: data, mime: 'video/mp4', body });
  assert.equal(result.id, 'VID42');
  assert.ok(injected, 'se inyectó el 503');
  assert.ok(Buffer.concat(received).equals(data), 'el contenido llegó íntegro y en orden');
  assert.equal(sessionBody.snippet.title, 'Prueba');
  assert.equal(sessionBody.status.privacyStatus, 'private');
  srv.close();
  ok(`subida reanudable: sobrevive a un 503 y entrega los ${data.length} bytes intactos (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

await fs.rm(tmp, { recursive: true, force: true });
console.log(`\nTodo en orden (${n} bloques).`);
