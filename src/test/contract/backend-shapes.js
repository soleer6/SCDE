/* Response shapes or content types the backend really sends but its OpenAPI
 * does not declare (gap-10 in docs/tfg/03-backend-gaps.md), transcribed from
 * the Django code with a citation each.
 *
 * The contract test accepts these as alternatives to the declared schema and
 * fails when an alternative stops being needed (the gap was fixed).
 *
 * 22/10/2026: snapshot regenerated from the canonical contract of SCDEE-backend
 * fix/integracion-real b6ce6ff (SHA-256 e7890c006a79…). It declares the role
 * unions of exams and instances (InstanceList/InstanceDetail), typed
 * models_problems, nullable dates, the zones list, InstanceResponse.grades
 * (gap-1) and problem_id in StudentInstance (gap-2): every shape that used to
 * live here was retired after the contract tests passed without it.
 */

/* Keyed by "METHOD template" (without /api/v1). */
export const BACKEND_SHAPES = {};

/* apps/instances/views/instances.py · InstanceDownloadView: the student owner
 * without can_download_pages gets the PDF AES-GCM encrypted as
 * application/octet-stream (only the description says so; `responses` lists
 * application/pdf). Still undeclared in b6ce6ff. */
export const BACKEND_CONTENT_TYPES = {
  'GET /instances/{instance_pk}/download/': ['application/octet-stream'],
};

/* Same idea for the answers to mutations (src/test/contract/mutations.js). */
export const MUTATION_SHAPES = {};
