# Weekly Language Rotation

A small, self-contained study tracker for the Serbian / Italian / Mexican Spanish
rotation — daily checklist, an end-of-month review, a "where you're at" position
tracker, and a study streak. No build step, no framework, no backend of its own:
just `index.html` + `style.css` + `app.js`, meant to be hosted for free on
GitHub Pages and added to your iPhone's home screen like an app.

## 1. Put it on GitHub

1. Go to github.com and create a **new repository** (e.g. `language-rotation`).
   Public or private both work fine for Pages on a personal GitHub plan.
2. On your computer, in a terminal, from the folder containing these files:

   ```bash
   cd language-rotation   # wherever you unzipped this
   git init
   git add .
   git commit -m "Language rotation tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/language-rotation.git
   git push -u origin main
   ```

   (No git installed, or don't want the terminal? GitHub's web UI also lets you
   drag-and-drop all these files into a new repo directly — "Add file" →
   "Upload files" on the repo's page.)

## 2. Turn on GitHub Pages

1. In the repo on GitHub: **Settings → Pages**.
2. Under "Build and deployment", set **Source** to "Deploy from a branch".
3. Branch: `main`, folder: `/ (root)`. Save.
4. GitHub gives you a URL a minute or two later, something like:
   `https://<your-username>.github.io/language-rotation/`

That URL is now your app — open it from your phone or your computer.

## 3. Add it to your iPhone home screen

1. Open the GitHub Pages URL above in **Safari** on your iPhone.
2. Tap the **Share** icon (square with an arrow).
3. Tap **Add to Home Screen**.

It now launches full-screen with its own icon, no address bar — the closest
thing to a real app without going through Apple's App Store (which needs
Xcode, a paid Apple Developer account, and App Store review — well beyond
what a page like this needs).

## 4. Syncing phone ↔ desktop (optional)

Without any setup, everything saves to that one browser's storage — fine if
you only ever use it on your phone. To see the same data on your computer
too, the app can keep a copy in a private **GitHub Gist**, synced straight
from the page to GitHub's API:

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Give it a name, an expiration you're comfortable with, and under
   **Permissions → Account permissions**, set **Gists** to **Read and write**.
   (It doesn't need access to any repository.)
3. Copy the generated token — GitHub only shows it once.
4. In the app, scroll to **"Sync between devices,"** paste the token, leave
   the Gist ID blank, and tap **Connect**. It creates a new private Gist and
   shows you its ID.
5. On your other device, open the same app URL, paste the **same token** and
   the **Gist ID** it gave you, and tap Connect. Both devices now read and
   write the same Gist.

**Worth knowing:** a "secret" Gist isn't truly access-controlled — it's only
unlisted (not on your profile, not searchable). Anyone who had the exact
Gist ID could view its contents. That's a fine tradeoff for a study
checklist, but don't put anything sensitive in the Notes fields, and don't
share the Gist ID or link. You can revoke the token any time from
**Settings → Developer settings → Personal access tokens**.

## Files

- `index.html` — the page itself
- `style.css` — all styling
- `app.js` — all behavior: checkboxes, the position tracker, the streak
  counter, and the GitHub Gist sync
- `manifest.json`, `sw.js` — make "Add to Home Screen" behave like a real
  app (its own icon, offline-friendly)
- `icon-180.png` / `icon-192.png` / `icon-512.png` / `favicon.png` — app icons

## Editing the content

The weekly grid, the end-of-month checklist, and the pacing numbers are all
plain HTML in `index.html` — open it in any text editor and change the text
directly (lesson names, day assignments, pacing estimates, etc.). Each
checkbox just needs a unique `data-id`; add or remove `<div class="block …">`
rows freely, and add or remove `<article class="day" data-day="…">` cards the
same way.
