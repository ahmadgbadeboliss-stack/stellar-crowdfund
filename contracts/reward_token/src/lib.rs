#![no_std]
//! Reward Token
//!
//! A minimal fungible token used to reward crowdfunding backers. It intentionally
//! keeps a small surface (init / mint / balance / transfer) so it can be driven by
//! another contract via cross-contract calls.
//!
//! Authorization model:
//! - `admin` can set/rotate the `minter`.
//! - only `minter` may `mint`. In this project the `minter` is the crowdfund
//!   contract's address, which is how backers automatically receive reward tokens
//!   when they pledge.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Minter,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
}

const EVT_MINT: Symbol = symbol_short!("mint");
const EVT_TRANSFER: Symbol = symbol_short!("transfer");
const EVT_INIT: Symbol = symbol_short!("init");

#[contract]
pub struct RewardToken;

#[contractimpl]
impl RewardToken {
    /// Initialize the token. Can only be called once.
    pub fn initialize(
        env: Env,
        admin: Address,
        minter: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        env.events().publish((EVT_INIT, admin), (minter, decimals));
        Ok(())
    }

    /// Rotate the authorized minter. Only callable by the admin.
    pub fn set_minter(env: Env, new_minter: Address) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &new_minter);
        Ok(())
    }

    /// Mint `amount` tokens to `to`. Only the configured minter may call this.
    /// The crowdfund contract is the minter, enabling automatic backer rewards.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .ok_or(TokenError::NotInitialized)?;
        minter.require_auth();

        let balance = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(balance + amount));

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));

        env.events().publish((EVT_MINT, to), amount);
        Ok(())
    }

    /// Transfer `amount` from `from` to `to`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        from.require_auth();

        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let to_balance = Self::balance(env.clone(), to.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        env.events().publish((EVT_TRANSFER, from, to), amount);
        Ok(())
    }

    /// Read the balance of `id`. Returns 0 if never credited.
    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn minter(env: Env) -> Result<Address, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Minter)
            .ok_or(TokenError::NotInitialized)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(0)
    }
}

mod test;
