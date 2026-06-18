# Sub-project A: Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs — Drive sync re-adding deleted recipes, and shopping list header buttons overflowing on mobile.

**Architecture:** Two independent single-file changes. Task 1 replaces the additive merge in `syncDrive()` with a last-write-wins timestamp comparison. Task 2 adds `flex-wrap: wrap` to the shopping header action bar in CSS.

**Tech Stack:** Vanilla JS, localStorage, Google Drive REST API, CSS flexbox.

**Note:** `connectDrive()` already calls `syncDrive()` after OAuth succeeds (line 307 of `data.js`) — auto-sync on connect is already implemented. No change needed there.

---

### Task 1: Fix Drive sync — last-write-wins (`js/data.js`)

**Files:**
- Modify: `js/data.js` — `syncDrive()` function (lines 349–408)

**Context:** The current merge (lines 368–393) only adds remote recipes to local — it never removes. So when a user deletes a recipe and syncs, Drive's older copy re-adds it. The fix: compare `lastUpdated` timestamps and let the newer side win the entire dataset.

- [ ] **Step 1: Read the current `syncDrive` function to confirm line numbers**

  Read `js/data.js` lines 349–408 to confirm the exact content before editing.

- [ ] **Step 2: Replace the merge block and toast**

  Find this block inside `syncDrive()`:
  ```js
      // Step 2: merge — add any recipes from Drive not already present locally
      const localIds = new Set(_db.recipes.map(r => r.id));
      const newRecipes = (remote.recipes || []).filter(r => !localIds.has(r.id));
      if (newRecipes.length) _db.recipes = [..._db.recipes, ...newRecipes];

      // Merge meal plan: fill local empty slots with Drive values
      const WEEKS = ['week1','week2','week3','week4'];
      WEEKS.forEach(w => {
        const remoteWk = (remote.mealPlan || {})[w] || {};
        DAYS.forEach(d => {
          const remoteDay = remoteWk[d] || {};
          MEALS.forEach(m => {
            if (remoteDay[m] && !(_db.mealPlan[w]?.[d]?.[m])) {
              _db.mealPlan[w] = _db.mealPlan[w] || {};
              _db.mealPlan[w][d] = _db.mealPlan[w][d] || {};
              _db.mealPlan[w][d][m] = remoteDay[m];
            }
          });
        });
        if (remoteWk.treats?.length && !(_db.mealPlan[w]?.treats?.length)) {
          _db.mealPlan[w].treats = remoteWk.treats;
        }
      });

      save();
      if (newRecipes.length) App.refresh();

      // Step 3: always push the merged result back to Drive
      await _uploadToDrive(fileId, token);

      const msg = newRecipes.length
        ? `Synced — pulled ${newRecipes.length} new recipe${newRecipes.length > 1 ? 's' : ''} from Drive ✓`
        : 'Synced with Drive ✓';
      App.toast(msg);
  ```

  Replace with:
  ```js
      // Step 2: last-write-wins — remote wins only if its lastUpdated is newer
      const remoteNewer = remote.lastUpdated && (!_db.lastUpdated || remote.lastUpdated > _db.lastUpdated);
      if (remoteNewer) {
        _db = { ..._db, ...remote };
        save();
        App.refresh();
      }

      // Step 3: always push local state to Drive
      await _uploadToDrive(fileId, token);

      App.toast(remoteNewer ? 'Synced — updated from Drive ✓' : 'Synced with Drive ✓');
  ```

  Note: `{ ..._db, ...remote }` spreads `_db` defaults first, then overrides with remote fields. This means any fields that exist locally but not in an older Drive backup (e.g. `spendLog`) are preserved rather than lost.

- [ ] **Step 3: Commit**

  ```bash
  git add js/data.js
  git commit -m "fix(data): replace additive Drive merge with last-write-wins"
  ```

---

### Task 2: Fix shopping list header overflow (`css/style.css`)

**Files:**
- Modify: `css/style.css` — `.section-header-actions` rule (around line 781)

**Context:** `.section-header-actions` currently has `display: flex; gap: 6px; align-items: center;` with no wrapping. Five buttons in this container overflow on mobile screens. Adding `flex-wrap: wrap` lets them wrap onto a second line.

- [ ] **Step 1: Read the current rule to confirm exact content**

  Search for `.section-header-actions` in `css/style.css` to confirm the current rule.

- [ ] **Step 2: Add `flex-wrap: wrap`**

  Find:
  ```css
  .section-header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  ```

  Change to:
  ```css
  .section-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add css/style.css
  git commit -m "fix(css): wrap shopping header action buttons on mobile"
  ```
