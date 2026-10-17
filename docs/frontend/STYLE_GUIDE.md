# SCDE — Style guide (binding for every agent)

Direction: **minimal, technical, dark**. Reference: the BREACHR prototype
(https://dtt-prodigys.vercel.app/) — near-black canvas, warm off-white text, one
gold signal colour, hairline rules, monospace body, serif display. We are building
a *working tool* for graders and students, not a landing page: density and
clarity beat spectacle.

## 1. Tokens (src/styles/tokens.css) — never hardcode
| Role | Token | Use |
|---|---|---|
| page | `--bg` #07080a | body |
| panel / input | `--bg-2` | forms, dialogs, raised blocks |
| hover row | `--bg-3` | table hover, button hover |
| rules | `--line`, `--line-2`, `--line-3` | 1px borders, dividers |
| text | `--fg`, `--muted`, `--dim` | `--dim` is decorative/disabled only |
| signal | `--gold` | primary action, current step, focus, selection |
| pass | `--green` | passed, done, healthy |
| fail | `--rust` | failed, errors, destructive |
| info | `--steel` | in progress, neutral info |

Type: `--mono` (JetBrains Mono 300, 13px) for everything; `--serif` (Instrument
Serif 400) only for page titles (`.ui-h1/.ui-h2/.ui-h3`), big numbers (grades,
stats) and the login display. Sizes via `--fs-*`. Spacing via `--s-1..9` (4px base).

## 2. Hard rules (checked by `npm run audit:style`)
1. No raw colours, no `font-family`, no `border-radius`, no `box-shadow` in features.
2. Never restyle `.ui-*` classes. Compose primitives; feature CSS uses its own
   prefix (`.grading-*`, `.admin-*`, …).
3. All visible copy goes through i18n (`t('ns:key')`), ES and EN.
4. Square corners. Hierarchy comes from hairlines, spacing and type — not shadows/cards.
5. Inline `style` only for dynamic geometry (canvas size, progress width).

## 3. Composition rules (reviewed by the auditor)
- **Pages** start with `<PageHeader crumbs eyebrow title lede actions />`. Eyebrow =
  real context (subject code · course), not decoration.
- **Lists of records** → `DataTable` (dense rows, tabular numbers, row click to drill in).
  Not card grids. Card-like `Panel` only for genuinely distinct blocks.
- **Numbers that matter** (grade, totals) → serif, large, `u-num`. Colour only if it
  carries meaning (green ≥ pass threshold, rust < pass).
- **Status** → `Badge` with tone mapped from the state machine (see §4).
- **Sequences** (instance lifecycle, wizard steps) → `StatusRail` with `01 → 02`.
  Numbering is ONLY for real sequences.
- **Primary action**: at most one `variant="solid"` per view. Others `primary` / default / `ghost`.
- **Destructive** → `variant="danger"` + `Dialog` confirmation.
- **Empty states** say what to do next and offer the action. **Errors** use
  `ErrorState` (symbolic backend code → translated message + retry).
- **Loading** → `Loader` (thin gold scan line); never spinners.
- Motion: only in response to user action, or the single loader. No entrance animations.
- Copy: sentence case in prose, UPPERCASE only for labels/buttons via CSS (the
  primitives already do it — never type caps in the source). Active verbs:
  "Publicar notas", toast "Notas publicadas".

## 4. Status → tone (instance state machine, backend `InstanceStatus`)
| Status | Tone |
|---|---|
| ASSEMBLING, RECEIVED, QUEUED | steel |
| PENDING_GRADING | gold |
| GRADED | green (plain for teacher lists) |
| PUBLISHED | green |
| IN_REVIEW, PENDING_REVIEW | gold |
| FINALIZED, ARCHIVED | none (muted) |

## 5. Accessibility floor
Visible focus (gold 1px outline, built in), labels on every control (`Field`),
keyboard row navigation (`DataTable` rows are focusable), `--muted` is the minimum
contrast for real text, reduced motion respected (tokens collapse durations).

## 6. Responsive
≥900px: top bar + left rail + content. <900px: rail becomes a horizontal strip.
Tables scroll horizontally inside `.ui-table-wrap`; nothing else may overflow the page.
