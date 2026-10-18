import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import env, { integrations } from '../config/env.js';
import { badRequest } from '../lib/errors.js';
import { fetchJson } from '../lib/util.js';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
const run = promisify(execFile);

import { BACKEND_ROOT } from '../config/paths.js';
export const UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads');
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

/** Validates real image content (not just the extension), strips metadata, produces large + thumb WebP. */
export async function storeImage(buffer, folder = 'products') {
  let meta;
  try { meta = await sharp(buffer).metadata(); } catch { throw badRequest('That file is not a valid image.'); }
  if (!ALLOWED.has(meta.format)) throw badRequest('Only JPEG, PNG, WebP or AVIF images are allowed.');
  if ((meta.width || 0) < 300) throw badRequest('Image is too small. Please upload at least 800px wide photos.');
  const big = await sharp(buffer).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const small = await sharp(buffer).rotate().resize({ width: 560, height: 560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  const id = crypto.randomBytes(10).toString('hex');

  if (integrations.cloudinary) {
    const up = async (buf, suffix) => {
      const ts = Math.floor(Date.now() / 1000);
      const publicId = `eshtyle/${folder}/${id}${suffix}`;
      const sig = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${ts}${env.CLOUDINARY_API_SECRET}`).digest('hex');
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'image/webp' }));
      form.append('public_id', publicId); form.append('timestamp', String(ts)); form.append('api_key', env.CLOUDINARY_API_KEY); form.append('signature', sig);
      const r = await fetchJson(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form }, { retries: 0, timeoutMs: 60000 });
      if (!r.ok) throw new Error(`Cloudinary upload failed ${r.status}`);
      return r.body;
    };
    const a = await up(big.data, ''); const b = await up(small, '-sm');
    return { url: a.secure_url, thumb: b.secure_url, width: big.info.width, height: big.info.height, publicId: a.public_id };
  }
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${id}.webp`), big.data);
  await fs.writeFile(path.join(dir, `${id}-sm.webp`), small);
  return { url: `/uploads/${folder}/${id}.webp`, thumb: `/uploads/${folder}/${id}-sm.webp`, width: big.info.width, height: big.info.height };
}

const isMp4 = (b) => b.length > 12 && b.toString('ascii', 4, 8) === 'ftyp';
const isWebm = (b) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
async function hasFfmpeg() { try { await run('ffmpeg', ['-version']); return true; } catch { return false; } }

/**
 * Stores an uploaded reel. Accepts only real MP4/MOV or WebM files (checked by content, not extension).
 * When ffmpeg is installed on the server, the video is re-encoded for the web (H.264, max 1280px, no audio,
 * fast start) and a poster frame is made; otherwise the file is stored as uploaded.
 */
export const PRIVATE_DIR = path.join(BACKEND_ROOT, 'private-uploads');

/** opts.private = evidence videos (return claims): kept outside the public /uploads folder and served only to staff. */
export async function storeVideo(buffer, opts = {}) {
  if (!isMp4(buffer) && !isWebm(buffer)) throw badRequest('Please upload an MP4 or WebM video.');
  const id = crypto.randomBytes(10).toString('hex');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-'));
  const ext = isWebm(buffer) ? 'webm' : 'mp4';
  const src = path.join(tmp, `in.${ext}`);
  await fs.writeFile(src, buffer);
  let out = src; let posterFile = null; let meta = {};
  try {
    if (await hasFfmpeg()) {
      const mp4 = path.join(tmp, 'out.mp4');
      await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { timeout: 180000 });
      out = mp4;
      const jpg = path.join(tmp, 'poster.jpg');
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', mp4, '-frames:v', '1', jpg], { timeout: 60000 }).catch(() => {});
      try { const pb = await fs.readFile(jpg); const m = await sharp(pb).metadata(); meta = { width: m.width, height: m.height }; posterFile = await sharp(pb).webp({ quality: 80 }).toBuffer(); } catch { /* no poster */ }
      try { const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]); meta.durationSec = Math.round(Number(stdout)); } catch { /* ignore */ }
    }
    const outExt = out.endsWith('.webm') ? 'webm' : 'mp4';
    const data = await fs.readFile(out);
    if (opts.private) {
      const dir = path.join(PRIVATE_DIR, 'returns');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${id}.${outExt}`), data);
      return { key: `returns/${id}.${outExt}`, size: data.length, ...meta };
    }
    if (integrations.cloudinary) {
      const up = async (buf, resource, type, suffix) => {
        const ts = Math.floor(Date.now() / 1000); const publicId = `eshtyle/reels/${id}${suffix}`;
        const sig = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${ts}${env.CLOUDINARY_API_SECRET}`).digest('hex');
        const form = new FormData(); form.append('file', new Blob([buf], { type })); form.append('public_id', publicId); form.append('timestamp', String(ts)); form.append('api_key', env.CLOUDINARY_API_KEY); form.append('signature', sig);
        const r = await fetchJson(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resource}/upload`, { method: 'POST', body: form }, { retries: 0, timeoutMs: 180000 });
        if (!r.ok) throw new Error(`Cloudinary upload failed ${r.status}`);
        return r.body.secure_url;
      };
      return { url: await up(data, 'video', `video/${outExt}`, ''), poster: posterFile ? await up(posterFile, 'image', 'image/webp', '-poster') : undefined, ...meta };
    }
    const dir = path.join(UPLOAD_DIR, 'reels');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.${outExt}`), data);
    if (posterFile) await fs.writeFile(path.join(dir, `${id}-poster.webp`), posterFile);
    return { url: `/uploads/reels/${id}.${outExt}`, poster: posterFile ? `/uploads/reels/${id}-poster.webp` : undefined, ...meta };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
