// Pruebas v30: hashtags en el título (≤100), música de fondo bajo la voz y sonoridad final, con ffmpeg real.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildMetadata, composeTitle } from '../lib/youtube.mjs';
import { planMix, mixGraph, mixBackgroundMusic, measureLufs, loadAudioConfig } from '../lib/audiomix.mjs';
import { hasFfmpeg } from '../lib/video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rincon-v30-'));
let n = 0;
const ok = (m) => console.log(`✓ v30.${++n} ${m}`);

// 1. Hashtags en el título
{
  assert.equal(composeTitle('Flash: ¿puede un humano correr así?', ['ciencia', 'flash', 'datos']), 'Flash: ¿puede un humano correr así? #ciencia #flash #Shorts');
  assert.equal(composeTitle('X', ['shorts', 'a', 'b', 'c']), 'X #a #b #Shorts', 'no duplica #Shorts y solo usa 2 del tema');
  const justFits = 'T'.repeat(100 - ' #ciencia'.length);
  assert.equal(composeTitle(justFits, ['ciencia', 'otro']).length, 100, 'cabe exacto');
  const t95 = 'T'.repeat(95);
  const r = composeTitle(t95, ['ciencia', 'otro']);
  assert.ok(r.length <= 100);
  assert.equal(r.slice(0, 95), t95, 'un título largo no se recorta para meter hashtags');
  assert.equal(composeTitle('T'.repeat(100), ['a']), 'T'.repeat(100), 'título de 100: no se añade nada');
  for (const len of [10, 40, 60, 80, 90, 97, 99, 100]) {
    const out = composeTitle('Ñ'.repeat(len), ['ciencia', 'curiosidades', 'otro']);
    assert.ok(out.length <= 100 && out.startsWith('Ñ'.repeat(len)), `longitud ${len}`);
  }
  const m = buildMetadata({ topic: 'x', description: { title: 'Flash: ¿puede un humano correr así?', text: 'Descripción', hashtags: ['#ciencia', '#flash'] } }, { privacy: 'private' });
  assert.equal(m.snippet.title, 'Flash: ¿puede un humano correr así? #ciencia #flash #Shorts');
  assert.ok(m.snippet.title.length <= 100);
  assert.match(m.snippet.description, /#ciencia #flash #Shorts$/, 'la descripción conserva todos los hashtags');
  const long = buildMetadata({ topic: 'x', description: { title: 'Una palabra '.repeat(12), text: 'd', hashtags: ['#ciencia'] } }, { privacy: 'private' });
  assert.ok(long.snippet.title.length <= 100, 'nunca supera los 100 caracteres de YouTube');
  ok('el título lleva hasta 2 hashtags del tema + #Shorts, sin pasar nunca de 100 caracteres ni recortar el título');
}

// 2. Cálculo puro de la mezcla
{
  const cfg = await loadAudioConfig(path.join(ROOT, 'automation', 'config', 'audio.json'));
  const p = planMix({ voiceLufs: -16, musicLufs: -12.5, musicDuration: 179.5, videoDuration: 40, cfg, rng: () => 0.5 });
  assert.ok(Math.abs(p.musicGainDb - ((-16 - cfg.musicBelowVoiceLU) + 12.5)) < 1e-9);
  assert.ok(p.musicGainDb < -15, 'la música (masterizada a −12,5 LUFS) se baja con fuerza');
  assert.ok(p.start > 0 && p.start < 179.5 - 40, 'inicio aleatorio dentro de la pista');
  assert.equal(p.needsLoop, false);
  const short = planMix({ voiceLufs: -16, musicLufs: -20, musicDuration: 10, videoDuration: 40, cfg, rng: () => 0.9 });
  assert.equal(short.needsLoop, true);
  assert.equal(short.start, 0);
  assert.ok(planMix({ voiceLufs: -16, musicLufs: -20, musicDuration: 100, videoDuration: 3, cfg }).fadeOut <= 1);
  const g = mixGraph({ plan: p, cfg, videoDuration: 40 });
  assert.match(g, /sidechaincompress=threshold=0\.05:ratio=3/);
  assert.match(g, /afade=t=out:st=38\.200:d=1\.800/);
  assert.match(g, /amix=inputs=2:duration=first:dropout_transition=0:normalize=0/);
  ok('plan de mezcla: música muy por debajo de la voz, inicio aleatorio, bucle si la pista es corta, fundidos');
}

// 3. Mezcla real con ffmpeg
if (await hasFfmpeg()) {
  const sh = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  const voice = "aevalsrc='0.3*(sin(2*PI*140*t)+0.6*sin(2*PI*280*t)+0.4*sin(2*PI*560*t))*(0.5+0.5*sin(2*PI*4*t))*lt(mod(t,4.5),3)':s=48000:c=stereo";
  const input = path.join(tmp, 'in.mp4');
  sh(['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=25', '-f', 'lavfi', '-i', voice, '-t', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', input]);
  const musicReal = path.join(ROOT, 'assets', 'music', 'lessons-in-sunlight.mp3');
  const haveMusic = await fs.stat(musicReal).then(() => true, () => false);
  let musicFile = musicReal;
  if (!haveMusic) { musicFile = path.join(tmp, 'music.wav'); sh(['-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100', '-t', '60', musicFile]); }
  const cfgFile = path.join(tmp, 'audio.json');
  await fs.writeFile(cfgFile, JSON.stringify({ file: musicFile }));
  const cfg = await loadAudioConfig(cfgFile);

  const out = await mixBackgroundMusic({ input, outDir: tmp, root: ROOT, configFile: cfgFile, rng: () => 0.5 });
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', out]).toString());
  assert.equal(info.streams.find((s) => s.codec_type === 'video').codec_name, 'h264');
  assert.equal(info.streams.find((s) => s.codec_type === 'audio').codec_name, 'aac');
  assert.ok(Math.abs(parseFloat(info.format.duration) - 24) < 0.4, 'misma duración que el vídeo');
  const integrated = await measureLufs(out);
  assert.ok(Math.abs(integrated - cfg.targetLufs) < 0.7, `sonoridad final ${integrated} ≈ ${cfg.targetLufs}`);
  const speech = await measureLufs(out, { start: 9.2, duration: 2.6 });
  const pause = await measureLufs(out, { start: 12.3, duration: 1.2 });
  const gapLU = speech - pause;
  assert.ok(gapLU > 10 && gapLU < 20, `música en pausas ~${cfg.musicBelowVoiceLU} LU bajo la voz (medido ${gapLU.toFixed(1)})`);
  // Ducking: misma mezcla con la voz silenciada (controla el sidechain) → solo se oye la música ya agachada
  const plan = planMix({ voiceLufs: -14.3, musicLufs: await measureLufs(musicFile), musicDuration: 60, videoDuration: 24, cfg, rng: () => 0.5 });
  const g = mixGraph({ plan, cfg, videoDuration: 24 }).replace('[vo][md]amix', '[vo]volume=0[vz];[vz][md]amix');
  const only = path.join(tmp, 'musiconly.wav');
  sh(['-i', input, '-ss', String(plan.start), '-i', musicFile, '-filter_complex', g, '-map', '[mx]', '-t', '24', only]);
  const duck = (await measureLufs(only, { start: 12.3, duration: 1.2 })) - (await measureLufs(only, { start: 9.4, duration: 2.4 }));
  assert.ok(duck > 6, `la música se agacha al menos 6 dB mientras habla (medido ${duck.toFixed(1)} dB)`);
  ok(`mezcla real: −14 LUFS finales, música ${gapLU.toFixed(0)} LU bajo la voz en pausas y agachada ${duck.toFixed(0)} dB más al hablar`);

  // Sin pista: solo normaliza
  const noMusicCfg = path.join(tmp, 'nomusic.json');
  await fs.writeFile(noMusicCfg, JSON.stringify({ enabled: false }));
  const plain = await mixBackgroundMusic({ input, outDir: tmp, root: ROOT, configFile: noMusicCfg });
  assert.ok(Math.abs((await measureLufs(plain)) - cfg.targetLufs) < 0.7);
  // Pista corta → bucle
  const shortMusic = path.join(tmp, 'short.wav');
  sh(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '5', shortMusic]);
  const loopCfg = path.join(tmp, 'loop.json');
  await fs.writeFile(loopCfg, JSON.stringify({ file: shortMusic }));
  const looped = await mixBackgroundMusic({ input, outDir: tmp, root: ROOT, configFile: loopCfg });
  assert.ok(Math.abs((await measureLufs(looped, { start: 20, duration: 3 })) - (await measureLufs(looped, { start: 8, duration: 3 }))) < 8, 'la música sigue sonando pasados los 5 s de la pista');
  // Audio en silencio → error (quien llama conserva el original)
  const silent = path.join(tmp, 'silent.mp4');
  sh(['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=25', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', silent]);
  await assert.rejects(mixBackgroundMusic({ input: silent, outDir: tmp, root: ROOT, configFile: cfgFile }), /silencio/);
  ok('sin pista solo normaliza; pista corta se repite; audio en silencio se rechaza');
}

// 4. Guion más corto en el prompt de la app
{
  const app = await fs.readFile(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(app, /100–120 palabras en total \(unas 16–20 por escena\)/);
  assert.ok(!app.includes('130–160 palabras'));
  ok('el guion pide 100–120 palabras (unos 40 s) en lugar de 130–160');
}

await fs.rm(tmp, { recursive: true, force: true });
console.log(`\nv30: todo en orden (${n} bloques).`);
