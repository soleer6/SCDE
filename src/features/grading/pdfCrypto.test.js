/* Student PDF protection: the vector below was produced by the backend itself
 * (encrypt_pdf(pdf, derive_user_key(uid)) run in the integration API container),
 * so these tests pin the frontend to Django's layout and key derivation rather
 * than to our own encryptPdf. The download tests go through the mock backend,
 * which answers like InstanceDownloadView: octet-stream for a student owner
 * without can_download_pages, plain application/pdf for teachers. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../app/registry.js'; // registers the feature mock handlers
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { getInstancePdfUrl } from './api.js';
import { decryptPdf, encryptPdf } from './pdfCrypto.js';

const DJANGO_UID = '7f0c2a9e-4b1d-4c3e-9a51-2d6f8e0b1c34';
const DJANGO_PLAIN = '%PDF-1.4\n% SCDE vector\n%%EOF\n';
const DJANGO_SEALED = '9TIsabfF3L9whwJ7iqe0S2RHCUC41sE6b2xvBFmdytGZ7zbkUqajVJHayTx/1pXzwGBY7Rb64tzD';

const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const readBlob = (blob) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });
const text = (bytes) => new TextDecoder().decode(bytes);

describe('decryptPdf', () => {
  it('opens what Django encrypted for that user', async () => {
    const blob = await decryptPdf(fromBase64(DJANGO_SEALED).buffer, DJANGO_UID);
    expect(blob.type).toBe('application/pdf');
    expect(text(await readBlob(blob))).toBe(DJANGO_PLAIN);
  });

  it('refuses another user, a tampered payload or a missing user', async () => {
    const sealed = fromBase64(DJANGO_SEALED);
    await expect(decryptPdf(sealed.buffer, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'PDF_DECRYPTION_FAILED' });
    const tampered = sealed.slice();
    tampered[20] ^= 1;
    await expect(decryptPdf(tampered.buffer, DJANGO_UID)).rejects.toMatchObject({ code: 'PDF_DECRYPTION_FAILED' });
    await expect(decryptPdf(sealed.slice(0, 20).buffer, DJANGO_UID)).rejects.toMatchObject({ code: 'PDF_DECRYPTION_FAILED' });
    await expect(decryptPdf(sealed.buffer, undefined)).rejects.toMatchObject({ code: 'PDF_DECRYPTION_FAILED' });
  });

  it('round-trips with the mock encryptor (fresh nonce each time)', async () => {
    const plain = new TextEncoder().encode(DJANGO_PLAIN);
    const a = await encryptPdf(plain, DJANGO_UID);
    const b = await encryptPdf(plain, DJANGO_UID);
    expect(a.slice(0, 12)).not.toEqual(b.slice(0, 12));
    expect(text(await readBlob(await decryptPdf(a.buffer, DJANGO_UID)))).toBe(DJANGO_PLAIN);
  });
});

// jsdom has no object URLs; give spyOn something to replace.
URL.createObjectURL ??= () => 'blob:mock';

describe('getInstancePdfUrl', () => {
  let created;
  async function loginAs(email, password) {
    const data = await api.post('/auth/login/', { email, password }, { auth: false });
    tokenStore.set(data.access_token, data.refresh_token);
    return data.user;
  }

  beforeEach(() => {
    localStorage.clear();
    db.reset();
    created = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob);
      return `blob:test-${created.length}`;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('decrypts the student copy when downloading is not allowed', async () => {
    const user = await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    const spy = vi.spyOn(crypto.subtle, 'decrypt');
    await expect(getInstancePdfUrl('i-e-mat-p1-1', user.id)).resolves.toBe('blob:test-1');
    expect(spy).toHaveBeenCalledOnce();
    expect(created[0].type).toBe('application/pdf');
    expect(text((await readBlob(created[0])).slice(0, 5))).toBe('%PDF-');
  });

  it('fails with a symbolic code, and no URL, when the key does not match', async () => {
    await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    await expect(getInstancePdfUrl('i-e-mat-p1-1', 'someone-else')).rejects.toMatchObject({ code: 'PDF_DECRYPTION_FAILED' });
    expect(created).toHaveLength(0);
  });

  it('serves the plain PDF as is to the teacher', async () => {
    const user = await loginAs('maria.perez@uam.es', 'prof123');
    const spy = vi.spyOn(crypto.subtle, 'decrypt');
    await getInstancePdfUrl('i-e-mat-p1-1', user.id);
    expect(spy).not.toHaveBeenCalled();
    expect(created[0].type).toBe('application/pdf');
    expect(text((await readBlob(created[0])).slice(0, 5))).toBe('%PDF-');
  });

  it('serves it plain to the student too once the exam allows downloading', async () => {
    db.exams.find((e) => e.id === 'e-mat-p1').student_permissions.can_download_pages = true;
    const user = await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    const spy = vi.spyOn(crypto.subtle, 'decrypt');
    await getInstancePdfUrl('i-e-mat-p1-1', user.id);
    expect(spy).not.toHaveBeenCalled();
    expect(text((await readBlob(created[0])).slice(0, 5))).toBe('%PDF-');
  });
});
