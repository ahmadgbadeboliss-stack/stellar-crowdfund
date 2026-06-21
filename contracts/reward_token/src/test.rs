#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(env: &Env) -> (RewardTokenClient<'_>, Address, Address) {
    let contract_id = env.register(RewardToken, ());
    let client = RewardTokenClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let minter = Address::generate(env);
    client.initialize(
        &admin,
        &minter,
        &String::from_str(env, "Backer Reward"),
        &String::from_str(env, "BRW"),
        &7u32,
    );
    (client, admin, minter)
}

#[test]
fn test_initialize_sets_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, minter) = setup(&env);

    assert_eq!(client.name(), String::from_str(&env, "Backer Reward"));
    assert_eq!(client.symbol(), String::from_str(&env, "BRW"));
    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.minter(), minter);
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_mint_increases_balance_and_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = setup(&env);
    let user = Address::generate(&env);

    client.mint(&user, &500i128);
    assert_eq!(client.balance(&user), 500);
    assert_eq!(client.total_supply(), 500);

    client.mint(&user, &250i128);
    assert_eq!(client.balance(&user), 750);
    assert_eq!(client.total_supply(), 750);
}

#[test]
fn test_transfer_moves_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint(&alice, &1000i128);
    client.transfer(&alice, &bob, &400i128);

    assert_eq!(client.balance(&alice), 600);
    assert_eq!(client.balance(&bob), 400);
}

#[test]
fn test_transfer_insufficient_balance_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint(&alice, &100i128);
    let res = client.try_transfer(&alice, &bob, &500i128);
    assert_eq!(res, Err(Ok(TokenError::InsufficientBalance)));
}

#[test]
fn test_mint_invalid_amount_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _minter) = setup(&env);
    let user = Address::generate(&env);

    let res = client.try_mint(&user, &0i128);
    assert_eq!(res, Err(Ok(TokenError::InvalidAmount)));
}

#[test]
fn test_double_initialize_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, minter) = setup(&env);

    let res = client.try_initialize(
        &admin,
        &minter,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
        &7u32,
    );
    assert_eq!(res, Err(Ok(TokenError::AlreadyInitialized)));
}
