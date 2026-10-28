// Metadatos y subida a YouTube (Data API v3, videos.insert con subida reanudable). Solo fetch, sin dependencias.
const TOKEN_URL = () => process.env.YT_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = () => process.env.YT_UPLOAD_URL || 'https://www.googleapis.com/upload/youtube/v3/videos';
const CHUNK = () => Math.max(262144, Math.floor((+process.env.YT_CHUNK_BYTES || 8 * 1024 * 1024) / 262144) * 262144);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => String(s ?? '').replace(/[<>\u0000]/g, '');

export class YouTubeError extends Error {
  constructor(message, { status, body, reason } = {}) {
    super(message);
    this.status = status;
    this.body = body;
    this.reason = reason;
  }
}

const HINTS = {
  quotaExceeded: 'Cuota diaria de la API agotada. Se restablece a medianoche (hora del Pacífico).',
  uploadLimitExceeded: 'El canal alcanzó su límite de subidas diarias de YouTube. Reduce la frecuencia o espera.',
  youtubeSignupRequired: 'La cuenta de Google no tiene un canal de YouTube creado.',
  insufficientPermissions: 'El token no tiene el permiso youtube.upload: vuelve a generar el refresh token.',
  forbidden: 'YouTube rechazó la operación (permisos o proyecto sin acceso a la API).',
  invalid_grant: 'El refresh token ya no sirve (revocado o caducado). Si la pantalla de consentimiento está en modo «Testing», caduca a los 7 días: publícala a «En producción» y genera otro token.',
};

function fail(prefix, status, text) {
  let reason = '';
  try {
    const j = JSON.parse(text);
    reason = j.error?.errors?.[0]?.reason || j.error?.status || (typeof j.error === 'string' ? j.error : '') || '';
  } catch { /* cuerpo no JSON */ }
  const hint = HINTS[reason] ? ` → ${HINTS[reason]}` : '';
  return new YouTubeError(`${prefix} (HTTP ${status}${reason ? ', ' + reason : ''})${hint}\n${String(text).slice(0, 600)}`, { status, body: text, reason });
}

// Recorta por bytes UTF-8 (YouTube admite 5000 bytes de descripción) cortando por líneas.
function fitBytes(text, max) {
  const lines = String(text).split('\n');
  while (Buffer.byteLength(lines.join('\n')) > max && lines.length > 1) lines.pop();
  let out = lines.join('\n');
  while (Buffer.byteLength(out) > max) out = out.slice(0, -1);
  return out.trimEnd();
}

export function buildMetadata(meta, opts = {}) {
  const privacy = ['private', 'unlisted', 'public'].includes(opts.privacy) ? opts.privacy : 'private';
  const d = meta.description || {};

  let title = strip(d.title || meta.topic || 'Short').replace(/\s+/g, ' ').trim() || 'Short';
  if (title.length > 100) title = title.slice(0, 97).trimEnd() + '…';

  const tags = [...new Set((Array.isArray(d.hashtags) ? d.hashtags : String(d.hashtags || '').split(/\s+/))
    .flatMap((h) => String(h).split(/\s+/))
    .map((h) => h.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean))].slice(0, 12);

  const hashLine = [...tags.map((t) => '#' + t), ...(tags.some((t) => t.toLowerCase() === 'shorts') ? [] : ['#Shorts'])].join(' ');
  const footer = '\n\n' + [opts.disclosure ? strip(opts.disclosure) : '', hashLine].filter(Boolean).join('\n');
  const body = strip(d.text || meta.topic || '').trim();
  const description = fitBytes(body, 4900 - Buffer.byteLength(footer)) + footer;

  const keyTags = [];
  let used = 0;
  for (const t of tags) {
    if (used + t.length + 3 > 450) break;
    keyTags.push(t);
    used += t.length + 3;
  }

  const status = {
    privacyStatus: privacy,
    selfDeclaredMadeForKids: false,
    embeddable: true,
    publicStatsViewable: true,
    license: 'youtube',
  };
  if (opts.synthetic !== 'omit') status.containsSyntheticMedia = opts.synthetic !== 'false';

  return {
    snippet: {
      title,
      description,
      tags: keyTags,
      categoryId: String(opts.categoryId || '27'),
      defaultLanguage: 'es',
      defaultAudioLanguage: 'es',
    },
    status,
  };
}

export async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new YouTubeError('Faltan YT_CLIENT_ID, YT_CLIENT_SECRET o YT_REFRESH_TOKEN (secrets del repositorio).');
  }
  const res = await fetch(TOKEN_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const text = await res.text();
  if (!res.ok) throw fail('No se pudo renovar el token de acceso', res.status, text);
  const token = JSON.parse(text).access_token;
  if (!token) throw new YouTubeError('Google no devolvió access_token.');
  return token;
}

async function startSession(token, size, mime, body) {
  const res = await fetch(`${UPLOAD_URL()}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(size),
      'X-Upload-Content-Type': mime,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw fail('YouTube rechazó crear la sesión de subida', res.status, text);
  const loc = res.headers.get('location');
  if (!loc) throw new YouTubeError('YouTube no devolvió la URL de la sesión de subida.');
  return loc;
}

// Pregunta cuántos bytes recibió el servidor. { done, json } si la subida ya terminó, { offset } si no.
async function queryProgress(session, size) {
  const res = await fetch(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${size}` } });
  if (res.status === 200 || res.status === 201) return { done: true, json: JSON.parse(await res.text()) };
  if (res.status === 308) {
    const r = res.headers.get('range');
    return { offset: r ? parseInt(r.split('-')[1], 10) + 1 : 0 };
  }
  throw fail('No se pudo consultar el progreso de la subida', res.status, await res.text());
}

export async function uploadVideo({ token, buffer, mime, body, onProgress = () => {} }) {
  const size = buffer.length;
  const session = await startSession(token, size, mime, body);
  const chunk = CHUNK();
  let offset = 0;
  let failures = 0;

  while (true) {
    const end = Math.min(offset + chunk, size) - 1;
    let res;
    try {
      res = await fetch(session, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${offset}-${end}/${size}`, 'Content-Type': mime },
        body: buffer.subarray(offset, end + 1),
      });
    } catch (e) {
      res = { status: 599, text: async () => String(e.message || e) };
    }

    if (res.status === 200 || res.status === 201) return JSON.parse(await res.text());
    if (res.status === 308) {
      const r = res.headers.get('range');
      offset = r ? parseInt(r.split('-')[1], 10) + 1 : 0;
      failures = 0;
      onProgress(offset, size);
      continue;
    }
    if (res.status >= 500) {
      if (++failures > 6) throw fail('La subida falló tras varios reintentos', res.status, await res.text());
      await sleep(Math.min(30000, 1000 * 2 ** failures));
      const p = await queryProgress(session, size);
      if (p.done) return p.json;
      offset = p.offset;
      continue;
    }
    throw fail('YouTube rechazó la subida', res.status, await res.text());
  }
}
