import { describe, expect, it } from 'vitest';
import { mockFetch, registerMocks } from './router.js';

describe('mock router', () => {
  it('prefers literal segments over params regardless of registration order', async () => {
    registerMocks([{ method: 'GET', path: '/things/:id/', auth: false, handler: ({ params }) => ({ by: 'param', id: params.id }) }], 'a');
    registerMocks([{ method: 'GET', path: '/things/export/', auth: false, handler: () => ({ by: 'literal' }) }], 'b');
    const lit = await (await mockFetch('http://x/api/v1/things/export/')).json();
    const par = await (await mockFetch('http://x/api/v1/things/42/')).json();
    expect(lit).toEqual({ by: 'literal' });
    expect(par).toEqual({ by: 'param', id: '42' });
  });
});
