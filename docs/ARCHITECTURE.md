# Architecture

## Overview

StellarFund is composed of **two Soroban smart contracts** and a **React
frontend**. The design intentionally splits responsibilities across two
contracts to demonstrate real inter-contract communication rather than bundling
everything into one.

## Contracts

### `reward_token`
A minimal fungible token (SEP-41-style surface): `initialize`, `mint`,
`transfer`, `balance`, `total_supply`, plus metadata (`name`, `symbol`,
`decimals`).

Authorization:
- `admin` sets/rotates the `minter`.
- only `minter` may `mint`.

In this system the **minter is the crowdfund contract's address**. That is the
key that makes automatic backer rewards possible without an extra signature from
the backer.

### `crowdfund`
The campaign factory and the heart of the app.

State per campaign (`Campaign` struct): `id`, `creator`, `title`, `goal`,
`raised`, `deadline`, `state` (Active/Successful/Failed/Claimed), `backers`.

Lifecycle:
1. `create_campaign(creator, title, goal, duration)` — opens a campaign.
2. `pledge(id, from, amount)` — records the pledge, updates totals, and makes a
   **cross-contract call** to `reward_token::mint(from, amount)`.
3. After the deadline:
   - `claim(id)` — creator withdraws if `raised >= goal`.
   - `refund(id, to)` — backer reclaims their pledge if the goal was missed.

## Inter-contract communication

`crowdfund` declares a typed client for the token:

```rust
#[contractclient(name = "RewardTokenClient")]
pub trait RewardTokenInterface {
    fn mint(env: Env, to: Address, amount: i128);
}
```

Inside `pledge`, after updating campaign state:

```rust
let token = RewardTokenClient::new(&env, &reward_token_address);
token.mint(&from, &amount);
```

Because the crowdfund contract is the token's authorized `minter`, this call
succeeds and the backer is credited reward tokens in the **same transaction** as
their pledge. A single `pledge` therefore emits two events across two contracts:

- `reward_token`: `mint`
- `crowdfund`: `pledge`

This is verifiable on the sample transaction in the README.

## Event streaming / real-time updates

Every state transition publishes an event:

| Contract | Events |
|---|---|
| crowdfund | `create`, `pledge`, `claim`, `refund`, `failed` |
| reward_token | `init`, `mint`, `transfer` |

The frontend polls Soroban RPC `getEvents` (filtered to both contract IDs) on a
6-second interval, dedupes by `txHash:type:ledger`, and renders a live feed. New
events also trigger a campaign refresh so balances/progress stay current without
a manual reload.

## Frontend

- **Reads** use transaction *simulation* (no wallet, no fees) to call
  `list_campaigns`.
- **Writes** build a transaction, `prepareTransaction` (footprint + resource
  fees), sign via Freighter, submit, and poll `getTransaction` until confirmed.
- Pure formatting/derivation logic lives in `lib/format.ts` with no SDK/DOM
  dependency, which keeps it fast to unit-test.

## Design decisions

- **Two contracts over one**: showcases inter-contract calls and mirrors how a
  reward/loyalty system would be modularized in production.
- **Integer amounts with 7 decimals**: matches Stellar's native precision; the
  UI scales user input by `10^7` and formats back for display.
- **Env-overridable config**: the same frontend bundle can point at a different
  deployment via `VITE_*` env vars — no code changes for redeploys.
