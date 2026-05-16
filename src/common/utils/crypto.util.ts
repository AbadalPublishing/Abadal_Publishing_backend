import * as crypto from 'crypto'

/**
 * AES-256-GCM encryption for sensitive fields at rest.
 *
 * Format: base64(iv ‖ authTag ‖ ciphertext)
 * Set ENCRYPTION_KEY env var to a 32-byte base64 string.
 * Generate one with: openssl rand -base64 32
 *
 * If ENCRYPTION_KEY is not set, falls back to a derived key from JWT_SECRET
 * (sufficient for development; in production set ENCRYPTION_KEY explicitly).
 */

const ALGO = 'aes-256-gcm'
const IV_LEN = 12      // GCM standard
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (raw) {
    const buf = Buffer.from(raw, 'base64')
    if (buf.length === 32) return buf
  }
  // Dev fallback: derive 32 bytes from JWT_SECRET
  const seed = process.env.JWT_SECRET || 'abadal-default-dev-secret-do-not-use-in-prod'
  return crypto.createHash('sha256').update(seed).digest()
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null) return null
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    const buf = Buffer.from(payload, 'base64')
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return null
  }
}

/**
 * Mask an account number for display: shows only last 4 digits.
 * "PK36SCBL0000001123456702" → "•••• •••• •••• 6702"
 */
export function maskAccount(num: string): string {
  if (!num) return ''
  const clean = num.replace(/\s+/g, '')
  const last4 = clean.slice(-4)
  return `•••• •••• •••• ${last4}`
}

/**
 * Hash OTP code (one-way, irrecoverable).
 * Used so even DB access can't reveal OTPs in transit.
 */
export function hashOtp(code: string): string {
  return crypto
    .createHmac('sha256', getKey())
    .update(code)
    .digest('hex')
}

export function verifyOtp(code: string, hashed: string): boolean {
  const expected = hashOtp(code)
  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hashed, 'hex'))
  } catch {
    return false
  }
}
