# Behavior Spec — H5P.DragQuestion

**Purpose.** This is the *durable* specification of what H5P.DragQuestion must do,
stated — wherever possible — at a boundary that survives reimplementation (jQuery →
web components → whatever comes next). The actual unit/integration/e2e tests are
**disposable bindings** to these expectations. When the implementation is rewritten, keep
this file, delete the coupled tests, and regenerate tests from the still-valid entries.

This file is the single source of "what must remain true" for the library, shared
across all test types. It is not a test file and runs nothing itself.

> Structure copied from `H5P.TrueFalse-1.8/tests/behavior_spec.md` (the canonical
> template) per `libraries/h5p-js-testing-shared/docs/05-adding-a-content-type.md`.

## Durability tiers (legend)

Order = most durable (survives full rewrite) → least (dies with the implementation).

| Tier | Meaning | Preferred test mechanic |
|---|---|---|
| `Invariant` | Property that holds for *any* implementation, any language. | property-based (fast-check) / assertion |
| `Contract` | Shape/behavior crossing a boundary H5P or the platform defines (H5P content-type contract, xAPI, semantics/params). | contract test / e2e |
| `Property` | Behavioral property across generated inputs (idempotence, inverse, round-trip). | property-based |
| `E2E-behavioral` | Observable output of the running content type given input. | playwright e2e / vdiff |
| `Impl-detail` | Coupled to current code structure; **expected to be discarded on rewrite.** | unit |

Each expectation records: **ID · statement · tier · current binding (test) · notes.**
`Current binding` may be `none (unverified)` until a test exists.

> **Execution context ≠ durability tier.** A `Contract` proven only against a **mock**
> of an H5P-internal collaborator (`H5PEditor.Presave`, `H5P.EventDispatcher`) is only
> *fully* honored once an integration binding exercises the real implementation. Rows
> below note this explicitly.

---

## Canonical fixtures (durable data)

No upstream sample `.h5p` package for DragQuestion exists in this workspace (same
situation as MultiChoice), so the "real, complete" fixtures below are hand-authored to
match the current `semantics.json` shape rather than extracted from a package — see
`docs/06-gotchas-and-field-notes.md`.

| Fixture | Purpose | Bound expectations |
|---|---|---|
| `tests/fixtures/content/two-zones.json` | Complete params, two elements each mapped to their own correct drop zone. | DQ-CON-01/02/03/04/05, DQ-E2E (future) |
| `tests/fixtures/content/single-point.json` | Complete params, `behaviour.singlePoint: true`, two elements sharing one drop zone. | DQ-CON-01 (singlePoint collapse) |
| `tests/fixtures/versions/1_1.json` … `1_14.json` | Frozen pre-migration snapshots, one per exercised `upgrades.js` step. | DQ-UPG-01..06 |
| `params.canonical.oneOfTwoCorrect() / noneCorrect() / multipleElement() / singlePoint()` (`tests/fixtures/params.js`) | Minimal presave/scoring oracles. | DQ-DATA-01/02, DQ-IMPL-03 |

New library versions add a new `versions/1_<minor>.json` snapshot; never edit older ones.

---

## Contracts — H5P content-type contract
See h5p.org/documentation/developers/contracts. These survive any UI rewrite.

| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-CON-01 | `getMaxScore()` returns `1` (the content weight) for single-point configurations, else 1 point per element with a correct drop zone (or 1 point per correct drop zone for a `multiple` element). | Contract | `tests/unit/scoring.spec.js` (extracted leaf) + `tests/unit/dragquestion-construct.spec.js` (live class) | Extracted into the additive `H5P.DragQuestion.scoring` leaf (parallels the inline logic; the shipped bundle still owns the live behaviour). Live-class binding covers the non-`multiple` case; the `multiple`-element leaf case is unit-only pending an e2e binding. |
| DQ-CON-02 | `getScore()` is `Σ(correctly-placed) − Σ(incorrectly-placed)`, clamped to `[0, maxScore]`, penalised by default (`applyPenalties`) or when `singlePoint`. | Contract | `tests/unit/scoring.spec.js` (leaf) + `tests/unit/dragquestion-construct.spec.js` (live class, via restored `previousState`) | Live-class binding exercises `previousState`-restored placements rather than a live drag; full drag interaction is e2e. |
| DQ-CON-03 | `getAnswerGiven()` is false before any interaction and no previous state, true after (or always true when a blank/no-placement submission is itself correct). | Contract | `tests/unit/dragquestion-construct.spec.js` | Blank-is-correct branch covered indirectly via `scoring.spec.js`'s `isBlankCorrect`/`scorePlacements`; needs a live-class binding for full coverage. |
| DQ-CON-04 | `getCurrentState()` returns `{answers: Array<{x,y,dz}[]>}` (per-element placement list, sparse/indexed like `question.task.elements`); restoring it reproduces the same placements and score. | Contract | `tests/unit/dragquestion-construct.spec.js` | Round-trip proven via `previousState` → `getCurrentState()` → same shape, and `getScore()` matches. |
| DQ-CON-05 | `resetTask()` returns the instance to the initial no-placement state, even without a prior render. | Contract | `tests/unit/dragquestion-construct.spec.js` | Confirmed the no-`$container` code path is DOM-free; full reset (including DOM/focus) is e2e. |
| DQ-CON-06 | `showSolutions()` marks every correctly/incorrectly-placed element regardless of the user's placements. | Contract | none | DOM-marking path (`markElement`); observable via DOM/e2e. |

## Contracts — xAPI
| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-XAPI-01 | An `answered` statement is produced with `interactionType: 'matching'`. | Contract | none | Needs main class → e2e. |
| DQ-XAPI-02 | `correctResponsesPattern` lists `dropZoneIndex[.]elementIndex` pairs for every correct placement. | Contract | none | Needs main class → e2e. |
| DQ-XAPI-03 | `result.response` lists the user's placements as `dropZoneIndex[.]elementIndex` pairs. | Contract | none | `getUserXAPIResponse()` is reachable without DOM in principle; not yet bound. |

## Contracts — data (semantics / upgrades / presave)
| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-DATA-01 | Presave yields `{maxScore: N}` where `N` is the count of DISTINCT draggable ids referenced by any drop zone's `correctElements` (via `Array.isArray(correctDropZones[elementIndex])`), summed per matching element (`multiple` elements contribute `correctDropZones.length`, NOT their own correct-zone count — see DQ-IMPL-03). | Contract | `tests/unit/presave.spec.js` (vs. **mock**) + `tests/integration/presave-real.spec.js` (vs. **real**) | Fixture: `params.canonical.oneOfTwoCorrect()` / `multipleElement()`. |
| DQ-DATA-02 | Presave yields `{maxScore: 1}` when no drop zone has any correct element, OR `behaviour.singlePoint === true`. | Contract | `tests/unit/presave.spec.js` (vs. **mock**) + `tests/integration/presave-real.spec.js` (vs. **real**) | Fixture: `params.canonical.noneCorrect()` / `singlePoint()`. Mirrors the "blank is correct" quirk also seen in the runtime's own `calculateMaxScore` (DQ-CON-01) and in MultiChoice's presave (MC-DATA-01). |
| DQ-DATA-03 | Presave throws `InvalidContentSemanticsException` when `question.task` is missing. | Contract | `tests/unit/presave.spec.js` (vs. **mock**) + `tests/integration/presave-real.spec.js` (vs. **real**) | The integration binding pins the real-core exception shape (`.code === 'H5P-P500'`); the mock hardcodes `.name`. |
| DQ-DATA-04 | Presave calls `H5PEditor.Presave.validateScore(score)`, which must accept the computed score. | Contract | `tests/unit/presave.spec.js` (implicit — no throw on valid content) + `tests/integration/presave-real.spec.js` | The mock's `validateScore` was already grown in `h5p-js-testing-shared` for MultiChoice; DragQuestion is a second, independent consumer of that shared surface — no further growth needed. |
| DQ-UPG-01 | Upgrade 1.1 moves flat behavioural keys (`enableTryAgain`→`enableRetry`, `preventResize`, `singlePoint`, `showSolutionsRequiresInput`) into `behaviour`, defaulting each to `true` when absent. | Contract | `tests/unit/upgrades.spec.js` | Fixture: `versions/1_1.json`. |
| DQ-UPG-02 | Upgrade 1.4 rewrites `H5P.Text` element library refs to `H5P.AdvancedText 1.0`, leaving other element types untouched. | Contract | `tests/unit/upgrades.spec.js` | Fixture: `versions/1_4.json`. |
| DQ-UPG-03 | Upgrade 1.11 moves the flat `feedback` string into a single `overallFeedback` range, groups each drop zone's flat `tip` into `tipsAndFeedback` (defaulting missing fields to `''`), and relocates `backgroundOpacity`/`dropZoneHighlighting`/`autoAlignSpacing`/`enableFullScreen` into `behaviour`. | Contract | `tests/unit/upgrades.spec.js` | Fixture: `versions/1_11.json`. |
| DQ-UPG-04 | Upgrade 1.13 sets `behaviour.showTitle` from `question.settings.showTitle` (default `false`) and `extras.metadata.title` from `question.settings.questionTitle` **verbatim, NOT HTML-stripped** (unlike MultiChoice's equivalent step) — with no fallback title when `question.settings` is absent. | Contract | `tests/unit/upgrades.spec.js` | Fixture: `versions/1_13.json`. Deliberately documents the no-HTML-stripping / no-fallback divergence from MC-UPG-06 rather than "fixing" it. |
| DQ-UPG-05 | Upgrade 1.14 filters each drop zone's `correctElements` down to element ids that (a) exist and (b) list that drop zone in their own `dropZones`. | Contract | `tests/unit/upgrades.spec.js` | Fixture: `versions/1_14.json`. |
| DQ-UPG-06 | Upgrade 1.15 sets `behaviour.dragHandleVisibility = false` for old content, only when `behaviour` is already an object. | Contract | `tests/unit/upgrades.spec.js` | No fixture file needed — trivial enough for inline params. |

## Invariants
| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-INV-01 | Score is always within `[0, getMaxScore()]`. | Invariant | `tests/unit/scoring.spec.js` (`scorePlacements` clamps negative totals to 0) + `tests/unit/dragquestion-construct.spec.js` (penalised wrong placement clamps to 0) | Full invariant (incl. `multiple` elements and the live class end-to-end) is e2e. |
| DQ-INV-02 | A `single`-flagged drop zone accepts at most one element at a time. | Invariant | none | Needs main class → e2e (enforced in `DropZone.accepts`, trapped in DOM drop handling). |

## Properties
| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-PROP-01 | State round-trip is lossless: `restore(getCurrentState())` reproduces the same `getScore()`. | Property | `tests/unit/dragquestion-construct.spec.js` (single fixed example, not yet generated) | Needs main class → e2e/property for the fully generated case (multiple elements, `multiple` flag). |
| DQ-PROP-02 | `resetTask()` is idempotent. | Property | none | Needs main class → e2e/property. |

## E2E / observable behavior
| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-E2E-01 | Dragging an element onto a valid drop zone places it there; dragging it onto an invalid (non-accepting) zone is rejected. | E2E-behavioral | none | Not yet built for this type — full jQuery-UI-adjacent (`H5P.Components.Draggable`/`Dropzone`) drag interaction. |
| DQ-E2E-02 | `multiple` elements can be placed in more than one drop zone simultaneously (cloning behaviour). | E2E-behavioral | none | Not yet built for this type. |
| DQ-E2E-03 | Keyboard-only interaction (select element → select drop zone) reproduces the same placement as drag-and-drop. | E2E-behavioral | none | The shipped bundle has a full keyboard-accessible `Controls`/`Keyboard` plugin path; not yet exercised. |
| DQ-E2E-04 | `showAllSolutions()` marks every correct/incorrect placement and disables further dragging. | E2E-behavioral | none | Not yet built for this type. |

## Implementation details (disposable — expected to die on rewrite)
Kept only so the current coupled unit tests trace to *something*; do not promote these.

| ID | Statement | Tier | Current binding | Notes |
|---|---|---|---|---|
| DQ-IMPL-01 | `h5p-drag-question.js` at the library root is a WEBPACK-BUILT, MINIFIED bundle (built from `src/drag-question.js` per `webpack.config.js`), not hand-authored source — but it is still checked in as a plain global-IIFE with no build step needed to consume it, matching every other Tier-2 legacy file tested so far. | Impl-detail | harness `tests/setup/h5p-globals.js` (loads it via `loadScript`, unmodified) | Confirmed: `library.json`'s `preloadedJs` references it directly (not a `dist/` path), and `vm.runInThisContext` evaluates it exactly like TrueFalse's/MultiChoice's hand-written files — no bundler step required at test time. See `docs/06-gotchas-and-field-notes.md`. |
| DQ-IMPL-02 | Scoring (`calculateMaxScore`/`Draggable.results`/`showAllSolutions`) is trapped inside the minified bundle's closures. | Impl-detail | extracted (parallel, not wired) to `js/drag-question-scoring.js` / `H5P.DragQuestion.scoring`, tested in `tests/unit/scoring.spec.js` | Additive leaf — assigns onto the existing `H5P.DragQuestion` namespace, added to `library.json`'s `preloadedJs` after the main script; does not change the shipped class's runtime behaviour (same pattern as `H5P.TrueFalse.scoring` / `H5P.MultiChoice.scoring`). |
| DQ-IMPL-03 | `presave.js`'s use of `correctDropZones.length` (rather than `correctDropZones[elementIndex].length`) to weight a `multiple` element's contribution means the presave-computed `maxScore` can UNDER-count relative to the runtime's own `calculateMaxScore()` for a `multiple` element accepted by more than one correct drop zone. | Impl-detail | `tests/unit/presave.spec.js` (`multipleElement` case, DQ-DATA-01) vs. `tests/unit/scoring.spec.js` (`calculateMaxScore` "multiple" case, DQ-CON-01) | Documented quirk/potential presave↔runtime maxScore mismatch; not "fixed" here — out of scope for a test-coverage change. Analogous in spirit to MultiChoice's `Math.max(...,1)` quirk (MC-IMPL-01), but a distinct root cause. |
| DQ-IMPL-04 | Global-IIFE loads against `H5P.jQuery`/`H5P.EventDispatcher`/`H5P.Question` at SCRIPT-LOAD time (not just construction), and against `H5P.JoubelUI`/`H5P.Components` only at RENDER time (`registerDomElements`/`createQuestionContent`). `jQuery.ui` (a `library.json` dependency) is never read directly by the bundle — only, presumably, internally by whatever `H5P.Components.Draggable`/`Dropzone` do at runtime, which these unit specs stub wholesale and therefore never exercise. | Impl-detail | harness `tests/setup/h5p-globals.js` | Dies when moving off globals/jQuery. This is the widest global surface of any content type ported so far (jQuery, EventDispatcher, Question, JoubelUI, Components — see field notes for the full enumeration and why `jQuery.ui` needed no local stub). |
| DQ-IMPL-05 | `getAnswerGiven()` (`this.answered \|\| this.blankIsCorrect`) is not coerced to a strict boolean: `this.answered` is assigned `previousState.answers.length` directly, so a truthy-but-non-`true` number (e.g. `2`) can be returned instead of `true`. | Impl-detail | `tests/unit/dragquestion-construct.spec.js` | Still correctly truthy for any caller using it as a boolean; documented rather than "fixed" — asserting the exact (non-boolean) value here rather than loosely as `.to.be.ok` so the quirk stays visible if it's ever "cleaned up" by accident. |

---

## Maintenance rule
When you add or change a test, add/append the matching expectation here and set its
`Current binding`. When promoting logic to a more durable boundary (e.g. fully wiring
`h5p-drag-question.js` to consume `H5P.DragQuestion.scoring`, or moving to web
components), re-tier the affected entries and drop the `Impl-detail` rows that no longer
apply.

When a `Contract` is proven only against a **mock** of an H5P collaborator, note the mock
in its binding and treat an **integration/parity** binding against the real
implementation as outstanding. DQ-DATA-01..04 carry that integration binding
(`tests/integration/presave-real.spec.js`); the generic mock↔real parity of the shared
`EventDispatcher`/`Presave` stubs (including the `validateScore` member grown for
MultiChoice, and now independently exercised by DragQuestion) is validated centrally in
the `h5p-js-testing-shared` package, so this content type trusts it rather than
re-proving it.


