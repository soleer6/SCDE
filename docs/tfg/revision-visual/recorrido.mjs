import { browser, fixture, session, shot, APP } from './recorrido-lib.mjs';
const fx = fixture(); const cx = fixture('fixtures-claude-closed.local.json');
const only = process.argv[2];
const b = await browser(); const all = [];
async function run(name, f, role, steps, opts) {
  if (only && !name.startsWith(only)) return;
  const { page, logs, ctx } = await session(b, f, role, opts);
  try { await steps(page, (n, full) => shot(page, `${name}-${n}`, full)); }
  catch (e) { logs.push(`[${name}] FALLO: ${e.message.split('\n')[0]}`); await shot(page, `${name}-ERROR`); }
  all.push(...logs); await ctx.close();
}
const go = async (p, path) => { await p.goto(APP + path); await p.waitForLoadState('networkidle'); };
await run('01-docente', fx, 'teacher', async (p, s) => {
  await s('inicio'); await go(p, '/subjects'); await s('asignaturas');
  await go(p, `/exams/${fx.examId}`); await s('examen');
  await go(p, `/instances/${fx.instanceId}/grade`); await p.waitForTimeout(1500); await s('correccion', false);
  await p.mouse.wheel(0, 700); await p.waitForTimeout(500); await s('correccion-desplazada', false);
  await go(p, '/reviews'); await s('revisiones');
});
await run('02-coordinacion', fx, 'manager', async (p, s) => {
  await s('inicio'); await go(p, `/exams/${fx.examId}`); await s('examen');
  await go(p, `/exams/${fx.examId}/setup`); await s('configuracion');
  await go(p, `/exams/${fx.examId}/issues`); await p.waitForTimeout(1000); await s('incidencias');
  await p.getByRole('tab', { name: /Todos/ }).click(); await p.locator('tbody tr').first().click(); await p.waitForTimeout(2500); await s('incidencias-miniaturas');
  const th = p.locator('button:has(img)').first(); if (await th.count()) { await th.click(); await p.waitForTimeout(800); await s('miniatura-ampliada', false); await p.keyboard.press('Escape'); }
  await go(p, '/scans'); await p.waitForTimeout(1000); await s('escaneos');
  await go(p, '/reviews'); await s('revisiones');
});
await run('03-alumno-sin-nota', fx, 'student', async (p, s) => { await go(p, `/exams/${fx.examId}`); await s('examen'); });
await run('04-alumno-revision-abierta', fx, 'publishedStudent', async (p, s) => {
  await go(p, `/exams/${fx.examId}`); await p.waitForTimeout(2500); await s('examen', false); await s('examen-completo');
});
await run('05-movil-alumno', fx, 'publishedStudent', async (p, s) => {
  await go(p, `/exams/${fx.examId}`); await p.waitForTimeout(2500); await s('examen');
}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
for (const role of Object.keys(cx).filter((k) => /student|requester|silent|manager|teacher/i.test(k) && typeof cx[k] === 'string' && cx[k].includes('@'))) {
  await run(`06-cerrada-${role}`, cx, role, async (p, s) => { await go(p, `/exams/${cx.examId}`); await p.waitForTimeout(2000); await s('examen'); });
}
console.log(all.join('\n'));
await b.close();
