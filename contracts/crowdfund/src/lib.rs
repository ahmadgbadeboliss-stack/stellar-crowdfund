#![no_std]
//! Crowdfund
//!
//! Advanced crowdfunding logic:
//! - Anyone can create a campaign with a funding `goal` and a `deadline`.
//! - Backers `pledge` native-token-denominated amounts (tracked on-ledger).
//! - On each pledge the contract makes a **cross-contract call** into the
//!   `reward_token` contract to mint backer-reward tokens 1:1 with the pledge.
//! - After the deadline: if the goal is met the creator can `claim`; otherwise
//!   backers can `refund`.
//! - Every state transition emits an **event** so the frontend can stream updates.
//!
//! This contract is the configured `minter` on the reward token, which is what
//! makes the automatic reward minting possible without extra user signatures.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, Address,
    Env, Map, String, Symbol,
};

/// Minimal client view of the reward token, used for the cross-contract mint.
#[contractclient(name = "RewardTokenClient")]
pub trait RewardTokenInterface {
    fn mint(env: Env, to: Address, amount: i128);
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    RewardToken,
    CampaignCount,
    Campaign(u32),
    Pledge(u32, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignState {
    Active = 0,
    Successful = 1,
    Failed = 2,
    Claimed = 3,
}

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub goal: i128,
    pub raised: i128,
    pub deadline: u64,
    pub state: CampaignState,
    pub backers: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CampaignNotFound = 3,
    DeadlinePassed = 4,
    DeadlineNotReached = 5,
    InvalidAmount = 6,
    InvalidGoal = 7,
    InvalidDeadline = 8,
    GoalNotMet = 9,
    GoalMet = 10,
    NotCreator = 11,
    NothingToRefund = 12,
    AlreadyClaimed = 13,
}

const EVT_CREATE: Symbol = symbol_short!("create");
const EVT_PLEDGE: Symbol = symbol_short!("pledge");
const EVT_CLAIM: Symbol = symbol_short!("claim");
const EVT_REFUND: Symbol = symbol_short!("refund");
const EVT_FAILED: Symbol = symbol_short!("failed");

#[contract]
pub struct Crowdfund;

#[contractimpl]
impl Crowdfund {
    /// Initialize the factory with an admin and the address of the reward token
    /// contract it will call into. Callable once.
    pub fn initialize(env: Env, admin: Address, reward_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);
        Ok(())
    }

    /// Create a new campaign. `duration` is seconds from now until the deadline.
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        goal: i128,
        duration: u64,
    ) -> Result<u32, Error> {
        creator.require_auth();
        if goal <= 0 {
            return Err(Error::InvalidGoal);
        }
        if duration == 0 {
            return Err(Error::InvalidDeadline);
        }
        Self::require_init(&env)?;

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        let deadline = env.ledger().timestamp() + duration;

        let campaign = Campaign {
            id,
            creator: creator.clone(),
            title,
            goal,
            raised: 0,
            deadline,
            state: CampaignState::Active,
            backers: 0,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(id), &campaign);
        env.storage()
            .instance()
            .set(&DataKey::CampaignCount, &(id + 1));

        env.events()
            .publish((EVT_CREATE, creator), (id, goal, deadline));
        Ok(id)
    }

    /// Pledge `amount` to a campaign. Records the pledge and mints reward tokens
    /// to the backer via a cross-contract call into the reward token.
    pub fn pledge(env: Env, id: u32, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut campaign = Self::get_campaign(&env, id)?;

        if env.ledger().timestamp() >= campaign.deadline {
            return Err(Error::DeadlinePassed);
        }

        // Track per-backer pledge total (used for refunds).
        let key = DataKey::Pledge(id, from.clone());
        let existing: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if existing == 0 {
            campaign.backers += 1;
        }
        env.storage().persistent().set(&key, &(existing + amount));

        campaign.raised += amount;
        if campaign.raised >= campaign.goal {
            campaign.state = CampaignState::Successful;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(id), &campaign);

        // --- Cross-contract call: mint reward tokens to the backer 1:1 ---
        let reward_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::RewardToken)
            .ok_or(Error::NotInitialized)?;
        let token = RewardTokenClient::new(&env, &reward_token);
        token.mint(&from, &amount);

        env.events()
            .publish((EVT_PLEDGE, from), (id, amount, campaign.raised));
        Ok(())
    }

    /// After the deadline, if the goal was met the creator claims the raised total.
    pub fn claim(env: Env, id: u32) -> Result<i128, Error> {
        let mut campaign = Self::get_campaign(&env, id)?;
        campaign.creator.require_auth();

        if env.ledger().timestamp() < campaign.deadline {
            return Err(Error::DeadlineNotReached);
        }
        if campaign.state == CampaignState::Claimed {
            return Err(Error::AlreadyClaimed);
        }
        if campaign.raised < campaign.goal {
            return Err(Error::GoalNotMet);
        }

        campaign.state = CampaignState::Claimed;
        let amount = campaign.raised;
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(id), &campaign);

        env.events()
            .publish((EVT_CLAIM, campaign.creator.clone()), (id, amount));
        Ok(amount)
    }

    /// After the deadline, if the goal was NOT met, a backer reclaims their pledge.
    pub fn refund(env: Env, id: u32, to: Address) -> Result<i128, Error> {
        to.require_auth();
        let mut campaign = Self::get_campaign(&env, id)?;

        if env.ledger().timestamp() < campaign.deadline {
            return Err(Error::DeadlineNotReached);
        }
        if campaign.raised >= campaign.goal {
            return Err(Error::GoalMet);
        }

        let key = DataKey::Pledge(id, to.clone());
        let pledged: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if pledged <= 0 {
            return Err(Error::NothingToRefund);
        }

        env.storage().persistent().set(&key, &0i128);
        campaign.raised -= pledged;
        if campaign.state != CampaignState::Failed {
            campaign.state = CampaignState::Failed;
            env.events()
                .publish((EVT_FAILED, campaign.creator.clone()), id);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(id), &campaign);

        env.events().publish((EVT_REFUND, to), (id, pledged));
        Ok(pledged)
    }

    // ---- Read-only views ----

    pub fn get_campaign(env: &Env, id: u32) -> Result<Campaign, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(id))
            .ok_or(Error::CampaignNotFound)
    }

    pub fn campaign(env: Env, id: u32) -> Result<Campaign, Error> {
        Self::get_campaign(&env, id)
    }

    pub fn campaign_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }

    /// Return all campaigns as a map keyed by id (convenient for the frontend).
    pub fn list_campaigns(env: Env) -> Map<u32, Campaign> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        let mut out = Map::new(&env);
        let mut i = 0u32;
        while i < count {
            if let Some(c) = env
                .storage()
                .persistent()
                .get::<DataKey, Campaign>(&DataKey::Campaign(i))
            {
                out.set(i, c);
            }
            i += 1;
        }
        out
    }

    pub fn pledged_amount(env: Env, id: u32, who: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Pledge(id, who))
            .unwrap_or(0)
    }

    pub fn reward_token(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::RewardToken)
            .ok_or(Error::NotInitialized)
    }

    fn require_init(env: &Env) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            Ok(())
        } else {
            Err(Error::NotInitialized)
        }
    }
}

mod test;
