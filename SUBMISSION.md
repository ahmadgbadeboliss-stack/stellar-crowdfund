# Submission Checklist — Status & Remaining Steps

Everything that can be built and run from code is **done and verified**. Three
items inherently need **your** accounts/actions (GitHub, Vercel, a screen/camera).
Exact commands are below.

## ✅ Done (in this repo)

| Checklist item | Status | Evidence |
|---|---|---|
| Advanced smart contracts | ✅ | `contracts/crowdfund`, `contracts/reward_token` |
| Inter-contract communication | ✅ | `crowdfund::pledge` → `reward_token::mint` (tx `15b516d1…`) |
| Event streaming / real-time | ✅ | contract events + frontend `getEvents` polling feed |
| Contract deployment address | ✅ | crowdfund `CDBLYYBCBWN5ZRBSKK5764E7VQIQQSTD2GVB4WSAZW7L3ABNI4GM7KDP` |
| Transaction hash for interaction | ✅ | `15b516d136c93f088b7c793597ffff299d79a40342d58410b5b30fe0c86e1c1c` |
| Mobile responsive frontend | ✅ | `frontend/src/styles.css` breakpoints; verify in DevTools |
| Error handling & loading states | ✅ | skeletons, error banner + retry, toasts, wallet guards |
| Tests (contracts + frontend) | ✅ | 13 contract + 18 frontend = **31 passing** |
| CI/CD pipeline | ✅ | `.github/workflows/ci.yml` |
| README + documentation | ✅ | `README.md`, `docs/` |
| 10+ meaningful commits | ✅ | 17 commits |

## ⬜ Remaining (needs your accounts) — ~15 min

### 1. Push to a public GitHub repo
```bash
# create the repo on github.com (public), then:
cd "c:/Users/Sober/Desktop/risein-l3"
git remote add origin https://github.com/<YOUR_USERNAME>/stellar-crowdfund.git
git push -u origin main
```
> This also triggers the **CI pipeline** — open the repo's **Actions** tab and
> wait for the green check (that's your CI screenshot).

### 2. Deploy the frontend (Vercel)
```bash
cd frontend
npm i -g vercel
vercel --prod        # set Root Directory = frontend if asked
```
Copy the resulting URL into `README.md` (the "Live demo" row).

### 3. Capture the 3 screenshots → `docs/screenshots/`
- `mobile.png` — open the live URL, DevTools device toolbar (iPhone), screenshot.
- `ci.png` — GitHub → Actions → latest passing CI run.
- `tests.png` — run `cd contracts && cargo test` **or** `cd frontend && npm test`.

### 4. Record the 1–2 min demo video
Show: connect wallet → create campaign → pledge → reward tokens minted + live
feed updates. Paste the link into `README.md` (the "Demo video" row).

### 5. Commit the screenshots + links
```bash
git add docs/screenshots/*.png README.md
git commit -m "docs: add submission screenshots and live links"
git push
```

## Notes
- Contracts are already **live on testnet** — you do not need to redeploy. If you
  want them under your own account, run `./scripts/deploy.sh <identity>` and update
  `frontend/.env` + `deployments.json`.
- The frontend defaults to the live contract IDs, so the deployed site works
  immediately with no env configuration.
