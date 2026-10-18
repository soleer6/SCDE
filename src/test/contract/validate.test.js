import { describe, expect, it } from 'vitest';
import { createValidator } from './validate.js';

const schemas = {
  Base: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  Score: { type: 'string', format: 'decimal', pattern: '^-?\\d{0,6}(?:\\.\\d{0,2})?$', nullable: true },
  Item: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      when: { type: 'string', format: 'date-time' },
      day: { type: 'string', format: 'date' },
      status: { enum: ['OPEN', 'DONE'], type: 'string' },
      score: { $ref: '#/components/schemas/Score' },
      tags: { type: 'array', items: { type: 'integer' } },
      meta: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['id', 'status'],
  },
};
const validate = createValidator(schemas);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

describe('contract validator', () => {
  it('accepts a conforming object', () => {
    const ok = { id: 'a', when: '2026-10-02T09:00:00.000Z', day: '2026-10-02', status: 'OPEN', score: '7.50', tags: [1, 2], meta: { k: 'v' } };
    expect(validate(ref('Item'), ok)).toEqual([]);
    expect(validate(ref('Item'), { id: 'a', status: 'DONE', score: null })).toEqual([]);
  });

  it('reports missing, mistyped, out-of-enum and invented fields', () => {
    const errors = validate(ref('Item'), { status: 'LATE', when: '2026-10-02', score: 7.5, tags: ['x'], meta: { k: 1 }, extra: true });
    expect(errors).toEqual([
      '$.id: required field missing',
      '$.when: "2026-10-02" is not a date-time',
      '$.status: "LATE" not in enum [OPEN, DONE]',
      '$.score: expected string(decimal), got number 7.5',
      '$.tags[0]: expected integer, got string "x"',
      '$.meta.k: expected string, got number 1',
      '$.extra: field not in the contract',
    ]);
  });

  it('checks allOf as one object and oneOf as alternatives', () => {
    const merged = { allOf: [ref('Base'), { type: 'object', properties: { name: { type: 'string' } } }] };
    expect(validate(merged, { id: 'a', name: 'n' })).toEqual([]);
    expect(validate(merged, { id: 'a', other: 1 })).toEqual(['$.other: field not in the contract']);
    const either = { oneOf: [ref('Base'), { type: 'array', items: ref('Base') }] };
    expect(validate(either, [{ id: 'a' }])).toEqual([]);
    expect(validate(either, 3)).toHaveLength(1);
  });
});
