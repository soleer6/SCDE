import { describe, expect, it } from 'vitest';
import { checkAnswer } from './mutations.js';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const zone = { id: UUID, zone_type: 'QR', attribute: '', x: 0.1, y: 0.1, width: 0.2, height: 0.2, page_profile_id: UUID };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('mutation contract check', () => {
  it('accepts a declared answer and a bodiless 204', async () => {
    expect(await checkAnswer('POST', '/page-profiles/:id/zones/', json(201, [zone]))).toEqual([]);
    expect(await checkAnswer('DELETE', '/exams/:id/', new Response(null, { status: 204 }))).toEqual([]);
  });

  it('rejects invented fields and undeclared success statuses', async () => {
    const errors = await checkAnswer('POST', '/page-profiles/:id/zones/', json(201, [{ ...zone, invented: true }]));
    expect(errors).toEqual([expect.stringMatching(/invented/)]);
    expect(await checkAnswer('DELETE', '/exams/:id/', json(200, {}))).toEqual([expect.stringMatching(/status not declared/)]);
  });

  it('holds errors to the backend envelope, not to the declared enum', async () => {
    expect(await checkAnswer('PUT', '/instances/:id/problems/:pid/grade/', json(409, { error_code: 'VERSION_CONFLICT' }))).toEqual([]);
    expect(await checkAnswer('POST', '/subjects/', json(400, { error_code: 'VALIDATION_ERROR', errors: { code: ['FIELD_REQUIRED'] } }))).toEqual([]);
    expect(await checkAnswer('POST', '/subjects/', json(409, { error_code: 'CONFLICT', detail: 'text' }))).toEqual([expect.stringMatching(/detail/)]);
    expect(await checkAnswer('POST', '/subjects/', json(400, { error_code: 'invalid' }))).toHaveLength(1);
  });

  it('flags routes the OpenAPI does not have', async () => {
    expect(await checkAnswer('POST', '/invented/', json(200, {}))).toEqual([expect.stringMatching(/not in the OpenAPI/)]);
  });
});
