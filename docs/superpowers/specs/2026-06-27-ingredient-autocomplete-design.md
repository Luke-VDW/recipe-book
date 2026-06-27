# Ingredient Autocomplete — Design

**Date:** 2026-06-27
**Status:** Approved for implementation

## Problem

When adding or editing a recipe, ingredient names are typed free-hand into the
`ing-name-*` text inputs of the recipe modal (`js/recipes.js`). Nothing nudges
the user toward names that already exist, so the same ingredient drifts into
multiple spellings — `"beef mince"`, `"Beef Mince"`, `"mince beef"`. That
inconsistency degrades everything keyed on ingredient name: the price book
(`Data.lookupPriceEntry`), calorie estimation, shopping-list category grouping,
and pantry matching all do case-insensitive *name* comparisons and silently miss
when the spelling differs.

## Goal

As the user types an ingredient name, surface a small dropdown of the
ingredient names that already exist in the **ingredient book** (the
`priceBook` — the app's canonical list of ingredient cards). Selecting one fills
the input with the exact stored name. If the ingredient isn't in the book, the
user just keeps typing as they do today — no friction, no forced selection.

## Approach

Use a native HTML **`<datalist>`**, shared by every ingredient-name input in the
modal.

Why datalist over a hand-rolled dropdown:

- **It is exactly the requested behaviour out of the box** — type-to-filter
  suggestions, click to fill, free text always allowed. No "forced selection".
- **Zero dependencies, no new event wiring, no z-index/positioning bugs.** Fits
  the project's vanilla, `innerHTML`-only philosophy (see `CLAUDE.md`).
- **Accessible and mobile-friendly** — the browser renders and positions the
  popup natively.
- The modal is rebuilt on every open, so the option list is always fresh
  against the current ingredient book — no cache to invalidate.

### Data source

`Data.getPriceBook()` returns `[{ ingredient, prices }]`. The `ingredient`
field is the canonical, normalised name (lowercased, descriptor words stripped —
see `ensurePriceBookEntries`/`STRIP_WORDS` in `data.js`). We surface those names
verbatim as `<option>` values, so a selection inserts the *exact* string the
price book is keyed on. That is what makes lookups line up afterwards — the whole
point of the feature.

Names are sorted alphabetically and de-duplicated (case-insensitive) for a tidy
list.

### Markup

One `<datalist id="ing-name-options">` is rendered inside the ingredients
form-group of the modal. Every ingredient-name input gains
`list="ing-name-options"` plus `autocomplete="off"` (so the browser's own form
history doesn't fight the datalist). Because all rows reference the same
datalist by id, rows added later via **＋ Add ingredient** get the suggestions
for free with no extra code.

## Scope

- **In:** the recipe add/edit modal ingredient rows in `js/recipes.js`.
- **Out:** Spoonacular import (creates recipes programmatically, no typing),
  shopping-list / pantry ad-hoc entry, and any change to how names are *stored*.
  Storage format is unchanged; no migration.

## Risk

Minimal and purely additive. If `Data.getPriceBook()` is empty the datalist is
empty and the input behaves exactly as it does today. No existing code path
changes behaviour.
