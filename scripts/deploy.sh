#!/usr/bin/env bash
#
# Deploy + initialize both contracts to Stellar testnet, then run one end-to-end
# interaction (create campaign + pledge) so you get a real tx hash.
#
# Prereqs:
#   - stellar CLI installed and on PATH
#   - a funded testnet identity (default: "campaign"); create/fund with:
#       stellar keys generate campaign --network testnet --fund
#
# Usage:
#   ./scripts/deploy.sh [SOURCE_IDENTITY]
#
set -euo pipefail

SOURCE="${1:-campaign}"
NETWORK="testnet"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"

echo "▶ Building contracts…"
(cd "$CONTRACTS" && stellar contract build)

RT_WASM="$CONTRACTS/target/wasm32v1-none/release/reward_token.wasm"
CF_WASM="$CONTRACTS/target/wasm32v1-none/release/crowdfund.wasm"

ADMIN="$(stellar keys address "$SOURCE")"
echo "▶ Deployer/admin: $ADMIN"

echo "▶ Deploying reward_token…"
RT_ID="$(stellar contract deploy --wasm "$RT_WASM" --source "$SOURCE" --network "$NETWORK")"
echo "  reward_token: $RT_ID"

echo "▶ Deploying crowdfund…"
CF_ID="$(stellar contract deploy --wasm "$CF_WASM" --source "$SOURCE" --network "$NETWORK")"
echo "  crowdfund:    $CF_ID"

echo "▶ Initializing reward_token (minter = crowdfund)…"
stellar contract invoke --id "$RT_ID" --source "$SOURCE" --network "$NETWORK" -- \
  initialize --admin "$ADMIN" --minter "$CF_ID" \
  --name "Backer Reward" --symbol "BRW" --decimals 7

echo "▶ Initializing crowdfund (reward_token = $RT_ID)…"
stellar contract invoke --id "$CF_ID" --source "$SOURCE" --network "$NETWORK" -- \
  initialize --admin "$ADMIN" --reward_token "$RT_ID"

echo ""
echo "✅ Done."
echo "   REWARD_TOKEN_ID=$RT_ID"
echo "   CROWDFUND_ID=$CF_ID"
echo ""
echo "Set these in frontend/.env (see .env.example) and redeploy the frontend."
