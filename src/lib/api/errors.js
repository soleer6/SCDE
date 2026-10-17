/* Backend errors are symbolic codes (RNF-8), never human text. The UI
 * translates them through the `common:errors.<CODE>` i18n keys. */

const STATUS_FALLBACK = {
  400: 'VALIDATION_ERROR',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMIT_EXCEEDED',
};

export class ApiError extends Error {
  /**
   * @param {string} code    symbolic error code, e.g. 'INVALID_CREDENTIALS'
   * @param {number} status  HTTP status (0 = network)
   * @param {object} [fields] field-level codes { email: ['FIELD_REQUIRED'] }
   * @param {object} [data]   raw body
   */
  constructor(code, status, fields = null, data = null) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.data = data;
  }

  /** First code for a field, or null. */
  fieldCode(field) {
    const v = this.fields?.[field];
    return Array.isArray(v) ? v[0] : v ?? null;
  }
}

export async function toApiError(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  const code = data?.error_code || STATUS_FALLBACK[res.status] || 'INTERNAL_ERROR';
  return new ApiError(code, res.status, data?.errors ?? null, data);
}
