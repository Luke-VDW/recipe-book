# Sub-project G: Navigation Restructure & UX Polish Design Spec

## Goal

Restructure the bottom navigation to give pantry and price book their own dedicated tab, move import access into the recipe tab's plus button, and add clear (×) buttons to all search bars.

---

## Navigation Changes

### Current tabs (5)
Recipes · Planner · Shop · **Import** · Settings

### New tabs (5)
Recipes · Planner · Shop · **Pantry** · Settings

The **Import** tab is removed. The **Pantry** tab is added in its place (same slot, same 5 tabs).

The `#view-import` view and all its JS logic remain unchanged — it's still navigated to, just via the FAB menu instead of the nav bar.

---

## FAB Menu — Plus Button

The existing FAB (`<button class="fab" onclick="Recipes.openAddModal()">＋</button>`) is changed to toggle a small action menu above it. The menu has two options:

```
┌────────────────────┐
│ ＋ Add manually    │
│ 🔍 Import recipe   │
└────────────────────┘
     ⊕  (FAB)
```

**Implementation:**
- A `<div id="fab-menu" class="fab-menu hidden">` is placed in `index.html` above the FAB, containing two buttons
- The FAB `onclick` calls `App.toggleFabMenu()` instead of opening the add modal directly
- "Add manually" calls `App.closeFabMenu(); Recipes.openAddModal()`
- "Import recipe" calls `App.closeFabMenu(); App.nav('import', null)`
- Clicking anywhere outside the menu closes it (a backdrop or `document.onclick` handler)
- `App.nav('import', null)` navigates to the import view without activating any nav button highlight

### `App.toggleFabMenu()` and `App.closeFabMenu()`
Added to `js/app.js`. `closeFabMenu` is also called whenever `App.nav()` is called (to close the menu on view change) and when the modal opens.

---

## Pantry Tab

The new Pantry nav button navigates to `#view-pantry` and calls `Pantry.render()`.

**Within the Pantry view**, a "Price Book →" button is rendered near the top (below the search bar, above the item list) that calls `App.pushView('pricebook','Price Book'); PriceBook.render()`. This matches the existing `pushView` pattern used throughout the app.

The Price Book view (`#view-pricebook`) is unchanged.

### Settings cleanup
The two Settings sections for Pantry and Price Book are removed from `index.html` (they're now accessible from the new tab). The "Analytics →" and other Settings sections remain.

---

## Search Clear Buttons

A small `×` button is added inside each search bar. Clicking it clears the input and triggers re-render.

All four search bars live in `index.html`:

| Search bar | Element ID | Clear action |
|---|---|---|
| Recipe search | `#recipe-search` | `Recipes.filter()` |
| Import search | `#import-search` | clear only |
| Pantry search | `#pantry-search` | `Pantry.filter()` |
| Price book search | `#pb-search` | `PriceBook.filter()` |

**Implementation pattern** — add a `<button class="search-clear">` immediately after each input inside the existing `.search-bar` div. The button is styled to appear inside the input using absolute positioning.

```html
<div class="search-bar" style="position:relative">
  <input id="recipe-search" ... />
  <button class="search-clear" onclick="document.getElementById('recipe-search').value=''; Recipes.filter()" title="Clear">×</button>
</div>
```

The import search clear just clears the input without re-searching (clearing the search field is enough; the user can re-search if needed).

---

## Files Changed

| File | Change |
|---|---|
| `index.html` | Replace Import nav tab with Pantry tab; change FAB onclick to `App.toggleFabMenu()`; add FAB menu HTML; add search clear buttons to all 4 search bars; add "Price Book →" button in pantry view; remove pantry/pricebook settings sections |
| `js/app.js` | Add `toggleFabMenu()`, `closeFabMenu()`; update `nav()` to close fab menu + call `Pantry.render()` for pantry view + add pantry to titles map; add `_checkImportKey()` call when navigating to import; add document click handler to close menu on outside click |
| `css/style.css` | Add FAB menu styles; add search clear button styles |

---

## Key Constraints

- The `#view-import`, `#view-pantry`, `#view-pricebook` view elements remain unchanged
- `App.nav('import', null)` must not crash when `null` is passed as the button element — guard the button highlight logic
- `Pantry.render()` is called when the Pantry nav tab is activated (same as how `App.nav` calls render for other views)
- The Settings page button for analytics, Google Drive sync, and API keys is unchanged
