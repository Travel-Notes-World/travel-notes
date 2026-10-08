/**
 * Where member photos are stored.
 *
 * - Cloudflare R2 (or any S3-compatible bucket) when all five S3_* variables are set.
 * - The local `media/` folder on a developer's own computer.
 * - Nowhere on Vercel without a bucket: a serverless function has no permanent disk, so uploads
 *   are switched off and the site says so. It never pretends an upload worked.
 */
import fs from 'node:fs'
import path from 'node:path'

const env = process.env

export const s3Config = () => {
  const { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env
  if (!S3_BUCKET || !S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null
  return {
    bucket: S3_BUCKET,
    endpoint: S3_ENDPOINT,
    region: env.S3_REGION || 'auto',
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  }
}

/** True when a photo can really be stored in this environment. */
export const uploadsAvailable = (): boolean => {
  if (s3Config()) return true
  // Vercel sets VERCEL=1. Anywhere else (a laptop, a test run) the local folder works.
  return !env.VERCEL
}

/** On a computer without a bucket, make sure the local photo folder exists before the first upload. */
export const ensureLocalFolder = (): void => {
  if (s3Config() || env.VERCEL) return
  fs.mkdirSync(path.resolve(process.cwd(), 'media'), { recursive: true })
}
