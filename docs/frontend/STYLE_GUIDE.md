# SCDE — Style guide (binding for every agent) · v2

**Direction: minimal and educational.** A calm, light study environment for
teachers and students — the role Moodle plays, done with restraint. The BREACHR
site shared by the user is a reference for *minimalism only* (hierarchy from space,
hairlines, few elements); its dark palette, gold accent, uppercase monospace labels
and "terminal" feel are explicitly **not** part of this product.

> v1 (dark/gold/mono, Oct 2026) was rejected by the user: "parece un Binance, no una
> app educativa". Token *names* from v1 (`--gold*`) remain as aliases of `--accent*`
> so older CSS keeps working; new code must use the v2 names.

## 1. Tokens (src/styles/tokens.css) — never hardcode
| Role | Token | Use |
|---|---|---|
| page | `--bg` #f6f7f9 | body background (cool paper) |
| surface | `--bg-2` #fff | panels, tables, inputs, cards |
| hover/selected | `--bg-3`, `--accent-wash` | row hover, active nav |
| PDF desk | `--desk` | background behind exam sheets |
| rules | `--line`, `--line-2`, `--line-3` | 1px borders |
| text | `--fg`, `--muted`, `--dim` | `--dim` only placeholders/disabled |
| primary | `--accent` ink blue (+ `-strong`, `-line`, `-wash`) | actions, links, current step, focus |
| pass | `--green*` | passed, done, published |
| attention | `--amber*` | pending, to grade, in review |
| fail/error | `--rust*` (red pen) | fail, errors, destructive |
| neutral info | `--steel*` | processing states |

Type: `--sans` (Atkinson Hyperlegible — built for legibility) for all UI text;
`--serif` (Source Serif 4, 600) for page titles and big numbers (grades, stats);
`--mono` only for codes (subject codes, NIA, ids). Sizes `--fs-*` (body 15px).
Shape: `--radius` (10px) panels/cards/dialogs, `--radius-sm` (6px) buttons/inputs,
`--radius-pill` badges. Elevation: only `--shadow-sheet` (PDF sheet, dialogs, toasts).

## 2. Hard rules (checked by `npm run audit:style`)
1. No raw colours / fonts; radius and shadows only through tokens.
2. Never restyle `.ui-*` classes in a feature. Feature CSS uses its own prefix.
3. All visible copy through i18n (ES + EN).
4. **Sentence case.** No `text-transform: uppercase`, no wide letter-spacing.
5. Inline `style` only for dynamic geometry.

## 3. Composition rules (reviewed by the auditor)
- Pages start with `<PageHeader crumbs eyebrow title lede actions />`. The eyebrow is
  real context (subject · date), short, muted.
- Records → `DataTable` (white table in a rounded frame). Distinct objects (subjects)
  may be cards. Avoid dashboards made of identical cards.
- Key numbers (grade, totals) → serif, large. Colour only when meaningful
  (green ≥ 5, red < 5).
- Status → `Badge` (soft pill) with tone from §4.
- Real sequences (instance lifecycle, onboarding steps) → `StatusRail` / numbered circles.
- One `variant="solid"` (filled blue) per view; secondary `primary` (blue outline) or default.
- Destructive → `variant="danger"` + `Dialog`.
- Empty states say what happens next; errors use `ErrorState`; loading uses `Loader`.
- Motion only in response to the user (and the loader).
- Copy: plain, friendly, active verbs; the same verb from button to toast
  ("Publicar notas" → "Notas publicadas"). Address users as "tú".

## 4. Status → tone
| Status | Tone |
|---|---|
| ASSEMBLING, RECEIVED, QUEUED | steel |
| PENDING_GRADING | gold (= amber, attention) |
| GRADED, PUBLISHED | green |
| IN_REVIEW, PENDING_REVIEW | gold (amber) |
| FINALIZED, ARCHIVED | none |
Badge tones: `accent`, `gold` (amber), `green`, `rust`, `steel`.

## 5. Accessibility floor
2px blue focus ring (built in), labels on every control, keyboard row navigation,
`--muted` minimum for real text, reduced motion respected.

## 6. Responsive
≥900px: top bar + white left nav + content. <900px: nav becomes a horizontal strip.
Tables scroll inside their frame; nothing else may overflow.
