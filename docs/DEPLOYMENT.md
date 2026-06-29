# Deployment Guide

## Contracts → Stellar Testnet

### One-time identity setup
```bash
stellar keys generate deployer --network testnet --fund
stellar keys address deployer
```

### Automated (recommended)
```bash
./scripts/deploy.sh deployer
```
This builds, deploys both contracts, initializes them, and wires the crowdfund
contract as the reward token's minter. It prints the two contract IDs.

### Manual
```bash
cd contracts
stellar contract build

RT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/reward_token.wasm \
  --source deployer --network testnet)

CF=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/crowdfund.wasm \
  --source deployer --network testnet)

ADMIN=$(stellar keys address deployer)

stellar contract invoke --id $RT --source deployer --network testnet -- \
  initialize --admin $ADMIN --minter $CF --name "Backer Reward" --symbol "BRW" --decimals 7

stellar contract invoke --id $CF --source deployer --network testnet -- \
  initialize --admin $ADMIN --reward_token $RT
```

### Smoke test (produces a real tx hash)
```bash
CREATOR=$ADMIN
stellar contract invoke --id $CF --source deployer --network testnet -- \
  create_campaign --creator $CREATOR --title "Clean Water Well" --goal 1000 --duration 2592000

stellar contract invoke --id $CF --source deployer --network testnet -- \
  pledge --id 0 --from $CREATOR --amount 500
# ^ emits both `pledge` (crowdfund) and `mint` (reward_token) events
```

## Frontend → Vercel

### Option A — CLI
```bash
cd frontend
npm i -g vercel
vercel          # link project (first time)
vercel --prod   # production deploy
```

### Option B — Dashboard
1. Push the repo to GitHub.
2. On vercel.com → **New Project** → import the repo.
3. Set **Root Directory** to `frontend`.
4. Framework preset auto-detects **Vite**. Deploy.

### Environment variables (optional)
Only needed if you deployed your own contracts. In Vercel → Project → Settings →
Environment Variables, add the keys from `frontend/.env.example`
(`VITE_CROWDFUND_ID`, `VITE_REWARD_TOKEN_ID`, etc.). Defaults already point at
the live testnet deployment.

## Netlify (alternative)
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Add a SPA redirect: `/*  /index.html  200`
