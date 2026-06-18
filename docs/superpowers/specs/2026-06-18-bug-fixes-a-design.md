# Sub-project A: Bug Fixes Design Spec

## Goal

Fix two bugs: (1) deleted recipes reappear after Drive sync because the merge is additive-only, and (2) shopping list header buttons overflow on mobile, blocking access to "Clear checked".

---

## Fix 1: Drive Sync — Last-Write-Wins

### Problem

Current `syncDrive()` merge (step 2) adds remote recipes to local but never removes. When a user deletes a recipe on their phone, the deletion is lost on the next sync because Drive still has the old version.

### Usage pattern

Single-user, one device at a time. They sync before switching devices. Last-write-wins is safe and correct.

### Solution

Replace the additive merge with a timestamp comparison. The device with the most recent `lastUpdated` timestamp wins the entire dataset.

**New sync flow in `syncDrive()`:**

```
1. Pull remote from Drive
2. Compare remote.lastUpdated vs _db.lastUpdated
   - If remote is newer  → _db = remote, save(), App.refresh()
   - If local is newer or equal → keep _db as-is (no merge)
3. Always push local _db to Drive
```

**Remove entirely:** the current recipe merge block (lines 369–371) and the meal plan merge block (lines 374–390).

**Toast messages:**
- Remote won: `"Synced — updated from Drive ✓"`
- Local won / equal: `"Synced with Drive ✓"`

### Auto-sync on connect

After `connectDrive()` receives a valid token from the OAuth popup and stores it, call `syncDrive()` automatically. This ensures the app is immediately up to date when the user signs in — no manual sync button press needed.

The `connectDrive()` function currently calls `App.toast('Connected to Google Drive ✓')` after storing the token. Change this to call `syncDrive()` instead (which shows its own toast).

### Files changed

- `js/data.js` — `syncDrive()`: replace merge block with timestamp comparison; `connectDrive()`: add `syncDrive()` call after token is stored

---

## Fix 2: Shopping List Header Overflow

### Problem

The shopping list header has 5 buttons (Price Book, Pantry, Log Purchase, Complete Shop, Clear checked) that overflow the screen width on mobile, making "Clear checked" inaccessible.

### Solution

Add `flex-wrap: wrap` to `.section-header-actions` in `css/style.css`. Buttons wrap to a second line on small screens. No HTML or JS changes needed. The buttons themselves remain as-is until Sub-project B redesigns the shopping list header.

### Files changed

- `css/style.css` — add `flex-wrap: wrap` to `.section-header-actions` rule

---

## Files Changed Summary

| File | Change |
|---|---|
| `js/data.js` | Replace additive merge in `syncDrive()` with last-write-wins; add `syncDrive()` call in `connectDrive()` after token stored |
| `css/style.css` | Add `flex-wrap: wrap` to `.section-header-actions` |
