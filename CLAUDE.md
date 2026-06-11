# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build process — this is vanilla HTML/CSS/JS deployed directly.

```bash
# Start a local dev server (required for Service Worker and CORS)
python -m http.server 8000
# Then open http://localhost:8000
```

No test suite, no linter, no bundler. Changes take effect immediately on reload. After modifying `sw.js` or any cached file, do a hard refresh (Ctrl+Shift+R) to bypass the Service Worker cache.

## Architecture

**Single-page app** with no framework. Six IIFE modules coordinate through a shared `Data` object:

| Module | Responsibility |
|---|---|
| `js/app.js` | Router, view stack, toast notifications, cooking timer, settings UI |
| `js/data.js` | LocalStorage persistence, Google Drive sync, all CRUD operations |
| `js/recipes.js` | Recipe list/filter/search, CRUD forms, ingredient parser |
| `js/planner.js` | 4-week meal planner grid |
| `js/shopping.js` | Shopping list rendering and category grouping |
| `js/spoonacular.js` | Spoonacular API search and recipe import |

**All modules are loaded via `<script>` tags in `index.html`** — no imports, no bundler. Each module is an IIFE that returns a public API object (e.g., `const Data = (() => { ... return { load, save, addRecipe }; })();`).

## Data Layer

All state lives in `Data._db` (a single JS object) which is persisted to `localStorage` as JSON on every mutation via `Data.save()`. The shape:

```javascript
{
  version: '1.1',
  recipes: [{ id, name, category, servings, prepMins, cookMins, ingredients, method, tags, source, savedDate }],
  mealPlan: { week1..week4: { monday..sunday: { breakfast, lunch, dinner } } },
  shoppingList: [{ name, unit, qty, recipes, checked }],
  pantry: []
}
```

Recipe `ingredients` is stored as a raw semicolon-delimited string (e.g., `"500g beef; 2 cloves garlic"`). The parser in `recipes.js` converts this to structured objects for display.

**Google Drive sync** is optional and manual — a single JSON file (`RecipeBook_Data.json`) on the user's Drive. Merge strategy is last-write-wins by `lastUpdated` timestamp.

## Routing

Views are toggled by adding/removing the `.active` CSS class. Navigation history is maintained as a JS array (`_viewStack`) in `app.js`. There is no URL router — `window.location.hash` is updated for browser history only.

Active views: `recipes`, `detail`, `planner`, `shopping`, `import`, `settings`.

## Key Patterns

- **DOM updates**: All rendering uses `element.innerHTML = ...` — there is no virtual DOM or templating engine.
- **Event handling**: Delegated to parent containers using `onclick` attributes or `addEventListener` on container elements.
- **CSS variables**: All colours are defined in `:root` in `css/style.css`. Primary palette: `--dk-green: #2d6a4f`, `--md-green: #40916c`, `--lt-green: #d8f3dc`.
- **`innerHTML` and XSS**: User-provided content is rendered via `innerHTML` throughout. This is acceptable for a single-user personal app but must not be changed to a multi-user or shared context without sanitisation.

## External Integrations

- **Google Drive**: OAuth 2.0 implicit flow. Client ID stored in localStorage. Auth happens via a popup (`oauth.html`) that `postMessage`s the token back. Scoped to `drive.file` only.
- **Spoonacular**: API key stored in localStorage under `spoonacularKey`. Rate-limited on the free tier.

## Deployment

Push all files from the `pwa/` directory to a GitHub repo root. Enable GitHub Pages (Settings → Pages → main branch, /root). See `SETUP.md` for the full Google OAuth and Spoonacular setup walkthrough.
