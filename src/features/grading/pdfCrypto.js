/* Client side of the student PDF protection (RF-16.6/16.7).
 *
 * When a student may view but not download their pages, Django answers
 * GET /instances/{id}/download/ with `application/octet-stream`: the composed
 * PDF encrypted with AES-256-GCM, laid out as nonce (12 bytes) + ciphertext + tag.
 * The key is SHA-256 of the UTF-8 string `scdee-pdf-key-{user_id}`
 * (apps/instances/services/instance_service.py: derive_user_key / encrypt_pdf). */
import { ApiError } from '../../lib/api/errors.js';

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** AES-GCM key for a user, as derive_user_key builds it. */
export async function derivePdfKey(userId, usages = ['decrypt']) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`scdee-pdf-key-${userId}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, usages);
}

/** nonce + ciphertext/tag -> PDF Blob. Throws ApiError('PDF_DECRYPTION_FAILED') on a bad key or payload. */
export async function decryptPdf(buffer, userId) {
  const bytes = new Uint8Array(buffer);
  if (!userId || bytes.length < NONCE_BYTES + TAG_BYTES) throw new ApiError('PDF_DECRYPTION_FAILED', 0);
  try {
    const key = await derivePdfKey(userId);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, NONCE_BYTES) },
      key,
      bytes.slice(NONCE_BYTES),
    );
    return new Blob([plain], { type: 'application/pdf' });
  } catch {
    throw new ApiError('PDF_DECRYPTION_FAILED', 0);
  }
}

/** encrypt_pdf, for the mock backend and tests. */
export async function encryptPdf(buffer, userId) {
  const key = await derivePdfKey(userId, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, buffer));
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return out;
}
