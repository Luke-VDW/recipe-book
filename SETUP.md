# Recipe Book PWA — Setup Guide

Follow these steps once to get the app live on GitHub Pages with Google Drive sync.

---

## Step 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in (create a free account if needed).
2. Click **New repository**.
3. Name it `recipe-book` (or anything you like).
4. Set it to **Public** (required for free GitHub Pages).
5. Click **Create repository**.
6. Upload all files from the `pwa/` folder into the repository root.
   - Drag and drop the files onto the GitHub upload page, **or**
   - Use GitHub Desktop for easier folder management.

---

## Step 2 — Enable GitHub Pages

1. In your repository, go to **Settings → Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Choose branch `main`, folder `/ (root)`.
4. Click **Save**.
5. After ~1 minute, your app will be live at:
   ```
   https://<your-github-username>.github.io/recipe-book/
   ```

---

## Step 3 — Set up Google Cloud for Drive sync

> This takes about 10 minutes and is free.

### 3a. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project dropdown at the top → **New Project**.
3. Name it `Recipe Book` → click **Create**.

### 3b. Enable the Google Drive API

1. In the left menu go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click it → click **Enable**.

### 3c. Create OAuth credentials

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. If prompted, configure the OAuth consent screen first:
   - User type: **External**
   - App name: `Recipe Book`
   - Support email: your email
   - Scroll down → **Save and Continue** through all steps
   - On the last step, click **Back to Dashboard**
4. Back on Credentials, click **Create Credentials → OAuth client ID** again.
5. Application type: **Web application**
6. Name: `Recipe Book PWA`
7. Under **Authorised JavaScript origins**, add:
   ```
   https://<your-github-username>.github.io
   ```
8. Under **Authorised redirect URIs**, add:
   ```
   https://<your-github-username>.github.io/recipe-book/oauth.html
   ```
9. Click **Create**.
10. Copy your **Client ID** (looks like `123456789-abc...apps.googleusercontent.com`).

---

## Step 4 — Configure the app

1. Open your live app at your GitHub Pages URL.
2. Tap **⚙️ Settings**.
3. Under **Google Drive Sync**, tap **Connect Google Drive**.
4. Paste your Client ID when prompted.
5. Sign in with your Google account and allow access.
6. The status will show **✓ Connected**.

---

## Step 5 — Add your Spoonacular API key (optional)

1. Go to [spoonacular.com/food-api](https://spoonacular.com/food-api) and sign up for a free account.
2. Find your API key in the dashboard.
3. In the app: **Settings → Spoonacular API Key** → paste the key → **Save**.

---

## Step 6 — Install the app on your phone

### iPhone (Safari)
1. Open the app URL in Safari.
2. Tap the **Share** button (box with arrow).
3. Tap **Add to Home Screen**.
4. Tap **Add**. Done — it appears as a native-looking app icon.

### Android (Chrome)
1. Open the app URL in Chrome.
2. Tap the three-dot menu → **Add to Home screen**.
3. Tap **Add**. Done.

---

## Importing your existing recipes

If you have `RecipeBook_Data.json` from the Google Sheets version:
1. Go to **Settings → Data → Import JSON**.
2. Select your `RecipeBook_Data.json` file.
3. All recipes and meal plan data will be loaded.

---

## Keeping the app updated

When you update the app files on GitHub:
1. Push the new files to your repository.
2. Open the app and do a **hard refresh** (pull down to refresh on mobile).
3. The service worker will update in the background.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Not connected" after OAuth | Check Client ID is correct, check redirect URI matches exactly |
| Sync fails | Token may have expired — tap Connect Drive again to re-authenticate |
| App not updating | Hard refresh the page or clear browser cache |
| Import search returns nothing | Check Spoonacular API key in Settings |
