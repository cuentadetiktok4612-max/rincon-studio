// Comprobación y normalización del vídeo exportado por la app, con ffprobe/ffmpeg.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const BIG = { maxBuffer: 64 * 1024 * 1024 };

export async function hasFfmpeg() {
  try {
    await run('ffprobe', ['-version']);
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

function rate(r) {
  const [a, b] = String(r || '0/1').split('/').map(Number);
  return b ? a / b : 0;
}

// Duración real decodificando el archivo (los WebM de MediaRecorder a veces no la declaran).
async function decodedDuration(file) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'info', '-i', file, '-f', 'null', '-'], BIG).catch((e) => ({ stderr: e.stderr || '' }));
  const all = [...String(stderr).matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (!all.length) return 0;
  const m = all[all.length - 1];
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

export async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], BIG);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  let duration = parseFloat(j.format?.duration) || parseFloat(v?.duration) || 0;
  if (!duration) duration = await decodedDuration(file);
  return {
    container: j.format?.format_name || '',
    duration,
    size: parseInt(j.format?.size, 10) || 0,
    video: v && { codec: v.codec_name, width: v.width, height: v.height, fps: rate(v.avg_frame_rate), pixFmt: v.pix_fmt },
    audio: a && { codec: a.codec_name, sampleRate: +a.sample_rate || 0, channels: a.channels || 0 },
  };
}

export async function meanVolume(file) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], BIG);
  const m = /mean_volume:\s*(-?[\d.]+|-inf)\s*dB/.exec(String(stderr));
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : parseFloat(m[1]);
}

// Devuelve { info, volume, problems[] }. Un problema impide la subida.
export async function checkVideo(file, expectedSec) {
  const info = await probe(file);
  const problems = [];
  if (!info.video) problems.push('El archivo no tiene pista de vídeo.');
  if (!info.audio) problems.push('El archivo no tiene pista de audio (narración ausente).');
  if (info.video && !(info.video.height > info.video.width)) problems.push(`El vídeo no es vertical (${info.video.width}×${info.video.height}).`);
  if (info.duration < 5) problems.push(`Duración sospechosamente corta: ${info.duration.toFixed(1)} s.`);
  if (info.duration > 180) problems.push(`Dura ${info.duration.toFixed(0)} s: supera los 3 minutos de un Short.`);
  if (expectedSec && Math.abs(info.duration - expectedSec) > Math.max(4, expectedSec * 0.12)) {
    problems.push(`La duración del archivo (${info.duration.toFixed(1)} s) no coincide con la del proyecto (${expectedSec.toFixed ? expectedSec.toFixed(1) : expectedSec} s).`);
  }
  let volume = null;
  if (info.audio) {
    volume = await meanVolume(file).catch(() => null);
    if (volume !== null && volume < -45) problems.push(`El audio está casi en silencio (volumen medio ${volume} dB).`);
  }
  return { info, volume, problems };
}

// Deja un MP4 H.264 + AAC con faststart. Si ya lo es, devuelve el mismo archivo.
export async function normalizeForYouTube(file, outDir, info) {
  const isMp4 = /mp4|mov/.test(info.container);
  if (isMp4 && info.video?.codec === 'h264' && info.audio?.codec === 'aac' && info.video.pixFmt === 'yuv420p') return file;
  const dest = path.join(outDir, 'short-youtube.mp4');
  await run('ffmpeg', [
    '-hide_banner', '-y', '-i', file,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    dest,
  ], BIG);
  return dest;
}
