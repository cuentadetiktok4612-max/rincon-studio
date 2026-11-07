// Mezcla la pista de fondo bajo la voz y normaliza la sonoridad final del Short, con ffmpeg.
//  1) mide la sonoridad de la voz+efectos del vídeo y la de la música (LUFS);
//  2) baja la música a «musicBelowVoiceLU» unidades por debajo de la voz;
//  3) la agacha otros ~8 dB mientras hay voz (sidechain) para que nunca tape la narración;
//  4) lleva la mezcla a targetLufs (−14, referencia de YouTube) con límite de pico.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const BIG = { maxBuffer: 64 * 1024 * 1024 };
const DEFAULTS = { enabled: true, file: 'assets/music/lessons-in-sunlight.mp3', musicBelowVoiceLU: 14, duckThreshold: 0.05, duckRatio: 3, fadeInSec: 0.8, fadeOutSec: 1.8, randomStart: true, targetLufs: -14, truePeakLimit: 0.84 };

export async function loadAudioConfig(file) {
  try { return { ...DEFAULTS, ...JSON.parse(await fs.readFile(file, 'utf8')) }; } catch { return { ...DEFAULTS }; }
}

// Sonoridad integrada (LUFS) de un archivo o de un tramo. -Infinity si es silencio.
export async function measureLufs(file, { start, duration } = {}) {
  const args = ['-hide_banner', '-nostats'];
  if (start != null) args.push('-ss', String(start));
  if (duration != null) args.push('-t', String(duration));
  args.push('-i', file, '-vn', '-af', 'ebur128', '-f', 'null', '-');
  const { stderr } = await run('ffmpeg', args, BIG);
  const tail = String(stderr).split('Summary:').pop();
  const m = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(tail);
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : parseFloat(m[1]);
}

async function durationOf(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], BIG);
  return parseFloat(stdout) || 0;
}

const f3 = (n) => (+n).toFixed(3);
// ebur128 informa el silencio como −70 LUFS, no como −inf.
const audible = (lufs) => Number.isFinite(lufs) && lufs > -50;

// Cálculo puro (se prueba sin ffmpeg).
export function planMix({ voiceLufs, musicLufs, musicDuration, videoDuration, cfg, rng = Math.random }) {
  const musicGainDb = (voiceLufs - cfg.musicBelowVoiceLU) - musicLufs;
  const fadeOut = Math.min(cfg.fadeOutSec, videoDuration / 3);
  const room = musicDuration - videoDuration - 1;
  const needsLoop = !(musicDuration > videoDuration + 1);
  const start = cfg.randomStart && room > 0 ? Math.floor(rng() * room * 10) / 10 : 0;
  return { musicGainDb, fadeIn: cfg.fadeInSec, fadeOut, start, needsLoop };
}

export function mixGraph({ plan, cfg, videoDuration }) {
  return [
    '[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo][sc]',
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${f3(plan.musicGainDb)}dB,afade=t=in:st=0:d=${f3(plan.fadeIn)},afade=t=out:st=${f3(Math.max(0, videoDuration - plan.fadeOut))}:d=${f3(plan.fadeOut)}[mu]`,
    `[mu][sc]sidechaincompress=threshold=${cfg.duckThreshold}:ratio=${cfg.duckRatio}:attack=20:release=500:makeup=1[md]`,
    '[vo][md]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mx]',
  ].join(';');
}

// Devuelve la ruta del vídeo final (con música y sonoridad normalizada). Lanza error si algo sale mal;
// quien llama conserva el vídeo original en ese caso.
export async function mixBackgroundMusic({ input, outDir, root, log = () => {}, rng = Math.random, configFile }) {
  const cfg = await loadAudioConfig(configFile || path.join(root, 'automation', 'config', 'audio.json'));
  const musicPath = path.resolve(root, cfg.file);
  const useMusic = cfg.enabled && (await fs.stat(musicPath).then((s) => s.isFile(), () => false));
  if (cfg.enabled && !useMusic) log('AVISO: no se encontró la pista de fondo', cfg.file, '→ solo se normaliza la sonoridad.');

  const videoDuration = await durationOf(input);
  const voiceLufs = await measureLufs(input);
  if (!audible(voiceLufs)) throw new Error('el audio del vídeo está en silencio; no se mezcla nada');
  const tmpMix = path.join(outDir, 'mix-temp.wav');
  let plan = null;

  if (useMusic) {
    const musicLufs = await measureLufs(musicPath);
    if (!audible(musicLufs)) throw new Error('la pista de fondo está en silencio o no se pudo medir');
    plan = planMix({ voiceLufs, musicLufs, musicDuration: await durationOf(musicPath), videoDuration, cfg, rng });
    const args = ['-hide_banner', '-y', '-i', input];
    if (plan.needsLoop) args.push('-stream_loop', '-1');
    args.push('-ss', String(plan.start), '-i', musicPath, '-filter_complex', mixGraph({ plan, cfg, videoDuration }).replace(/\[mx\]$/, '[mx]'), '-map', '[mx]', '-t', f3(videoDuration), '-c:a', 'pcm_f32le', tmpMix);
    await run('ffmpeg', args, BIG);
    log(`Música: ${path.basename(musicPath)} desde ${plan.start}s, ${plan.musicGainDb.toFixed(1)} dB (voz ${voiceLufs.toFixed(1)} LUFS)`);
  } else {
    await run('ffmpeg', ['-hide_banner', '-y', '-i', input, '-vn', '-af', 'aresample=48000,aformat=channel_layouts=stereo', '-c:a', 'pcm_f32le', tmpMix], BIG);
  }

  // Normalización de sonoridad de la mezcla completa
  const mixLufs = await measureLufs(tmpMix);
  if (!audible(mixLufs)) throw new Error('la mezcla quedó en silencio');
  const gain = cfg.targetLufs - mixLufs;
  const dest = path.join(outDir, 'short-youtube-mix.mp4');
  await run('ffmpeg', [
    '-hide_banner', '-y', '-i', input, '-i', tmpMix,
    '-filter_complex', `[1:a]volume=${f3(gain)}dB,alimiter=limit=${cfg.truePeakLimit}:attack=5:release=60:level=disabled[o]`,
    '-map', '0:v:0', '-map', '[o]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', dest,
  ], BIG);
  await fs.rm(tmpMix, { force: true });

  // Comprobación del resultado: misma duración y audio presente
  const outDur = await durationOf(dest);
  const outLufs = await measureLufs(dest);
  if (Math.abs(outDur - videoDuration) > 0.6) throw new Error(`la duración cambió (${videoDuration.toFixed(1)} → ${outDur.toFixed(1)} s)`);
  if (!audible(outLufs)) throw new Error('el vídeo final no tiene audio audible');
  log(`Audio final: ${outLufs.toFixed(1)} LUFS${useMusic ? ' con música de fondo' : ' (sin música)'}`);
  return dest;
}
