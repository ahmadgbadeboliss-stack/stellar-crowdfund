#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String,
};

// Bring in the real reward token contract for genuine cross-contract testing.
use reward_token::{RewardToken, RewardTokenClient as RtClient};

struct Ctx {
    env: Env,
    crowdfund: CrowdfundClient<'static>,
    reward: RtClient<'static>,
    creator: Address,
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy reward token.
    let reward_id = env.register(RewardToken, ());
    let reward = RtClient::new(&env, &reward_id);

    // Deploy crowdfund.
    let crowdfund_id = env.register(Crowdfund, ());
    let crowdfund = CrowdfundClient::new(&env, &crowdfund_id);

    let admin = Address::generate(&env);
    // The crowdfund contract must be the token's minter so pledges can mint.
    reward.initialize(
        &admin,
        &crowdfund_id,
        &String::from_str(&env, "Backer Reward"),
        &String::from_str(&env, "BRW"),
        &7u32,
    );
    crowdfund.initialize(&admin, &reward_id);

    let creator = Address::generate(&env);
    Ctx {
        env,
        crowdfund,
        reward,
        creator,
    }
}

#[test]
fn test_create_campaign() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Build a well"),
        &1000i128,
        &3600u64,
    );
    assert_eq!(id, 0);
    let c = ctx.crowdfund.campaign(&id);
    assert_eq!(c.goal, 1000);
    assert_eq!(c.raised, 0);
    assert_eq!(c.state, CampaignState::Active);
    assert_eq!(ctx.crowdfund.campaign_count(), 1);
}

#[test]
fn test_pledge_mints_reward_tokens_cross_contract() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Art"),
        &1000i128,
        &3600u64,
    );

    let backer = Address::generate(&ctx.env);
    ctx.crowdfund.pledge(&id, &backer, &400i128);

    // Pledge recorded on the campaign.
    let c = ctx.crowdfund.campaign(&id);
    assert_eq!(c.raised, 400);
    assert_eq!(c.backers, 1);

    // Cross-contract mint credited the backer 1:1 on the reward token.
    assert_eq!(ctx.reward.balance(&backer), 400);
    assert_eq!(ctx.reward.total_supply(), 400);
}

#[test]
fn test_goal_met_marks_successful_and_creator_claims() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Goal"),
        &500i128,
        &3600u64,
    );
    let backer = Address::generate(&ctx.env);
    ctx.crowdfund.pledge(&id, &backer, &500i128);

    assert_eq!(ctx.crowdfund.campaign(&id).state, CampaignState::Successful);

    // Advance past the deadline, then creator claims.
    ctx.env.ledger().with_mut(|l| l.timestamp += 4000);
    let claimed = ctx.crowdfund.claim(&id);
    assert_eq!(claimed, 500);
    assert_eq!(ctx.crowdfund.campaign(&id).state, CampaignState::Claimed);
}

#[test]
fn test_refund_when_goal_not_met() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Fail"),
        &1000i128,
        &3600u64,
    );
    let backer = Address::generate(&ctx.env);
    ctx.crowdfund.pledge(&id, &backer, &300i128);

    // Deadline passes without meeting the goal.
    ctx.env.ledger().with_mut(|l| l.timestamp += 4000);
    let refunded = ctx.crowdfund.refund(&id, &backer);
    assert_eq!(refunded, 300);
    assert_eq!(ctx.crowdfund.pledged_amount(&id, &backer), 0);
    assert_eq!(ctx.crowdfund.campaign(&id).state, CampaignState::Failed);
}

#[test]
fn test_pledge_after_deadline_errors() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Late"),
        &1000i128,
        &100u64,
    );
    ctx.env.ledger().with_mut(|l| l.timestamp += 200);
    let backer = Address::generate(&ctx.env);
    let res = ctx.crowdfund.try_pledge(&id, &backer, &100i128);
    assert_eq!(res, Err(Ok(Error::DeadlinePassed)));
}

#[test]
fn test_claim_before_deadline_errors() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Early"),
        &100i128,
        &3600u64,
    );
    let backer = Address::generate(&ctx.env);
    ctx.crowdfund.pledge(&id, &backer, &100i128);
    let res = ctx.crowdfund.try_claim(&id);
    assert_eq!(res, Err(Ok(Error::DeadlineNotReached)));
}

#[test]
fn test_claim_goal_not_met_errors() {
    let ctx = setup();
    let id = ctx.crowdfund.create_campaign(
        &ctx.creator,
        &String::from_str(&ctx.env, "Short"),
        &1000i128,
        &100u64,
    );
    let backer = Address::generate(&ctx.env);
    ctx.crowdfund.pledge(&id, &backer, &100i128);
    ctx.env.ledger().with_mut(|l| l.timestamp += 200);
    let res = ctx.crowdfund.try_claim(&id);
    assert_eq!(res, Err(Ok(Error::GoalNotMet)));
}
