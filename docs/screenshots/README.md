# Screenshots

Place the three required submission screenshots in this folder. The README
references them at these exact paths:

- `mobile.png` — the dApp rendered at a mobile viewport (responsive UI).
- `ci.png` — the GitHub Actions CI run (green checkmarks on both jobs).
- `tests.png` — passing test output (contracts `cargo test` and/or frontend
  `npm test`, showing 3+ passing).

## How to capture

**Mobile UI**
1. Run `npm run dev` in `frontend/` (or open the live Vercel URL).
2. Open browser DevTools → toggle device toolbar (Ctrl/Cmd+Shift+M) → pick a
   phone (e.g. iPhone 12).
3. Screenshot the page.

**CI pipeline**
1. After pushing to GitHub, open the repo → **Actions** tab.
2. Open the latest **CI** run showing `contracts` and `frontend` jobs passing.
3. Screenshot.

**Tests**
- Contracts: `cd contracts && cargo test` → screenshot the summary.
- Frontend: `cd frontend && npm test` → screenshot the `Tests 18 passed` summary.
