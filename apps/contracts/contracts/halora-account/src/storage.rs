use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::error::Error;
use crate::types::{Approval, Policy, SpendState};

/// Seconds in one UTC day. Day bucket = ledger timestamp / SECONDS_PER_DAY.
pub const SECONDS_PER_DAY: u64 = 86_400;

/// Approximate ledgers per day at a 5 second close time.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Assumed ledger close time, used to convert an approval's lifetime into ledgers.
const SECONDS_PER_LEDGER: u64 = 5;
/// Extend the instance TTL when it drops below 30 days.
const INSTANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// Extend the instance TTL to 120 days (capped by the network maximum).
const INSTANCE_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Owner,
    Agent,
    Policy,
    Spend,
    /// Persistent: one pending pre-approval per recipient.
    Approval(Address),
}

/// Keeps the contract instance (and with it every key above) alive.
///
/// All state lives in instance storage, so a single TTL covers the whole account. If the
/// instance is ever archived, every call fails until it is restored, which is fail closed.
pub fn extend_instance(env: &Env) {
    let max = env.storage().max_ttl();
    let extend_to = INSTANCE_TTL_EXTEND_TO.min(max);
    let threshold = INSTANCE_TTL_THRESHOLD.min(extend_to);
    env.storage().instance().extend_ttl(threshold, extend_to);
}

pub fn current_day(env: &Env) -> u64 {
    env.ledger().timestamp() / SECONDS_PER_DAY
}

pub fn owner(env: &Env) -> Result<BytesN<32>, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Owner)
        .ok_or(Error::NotInitialized)
}

pub fn set_owner(env: &Env, owner: &BytesN<32>) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

pub fn agent(env: &Env) -> Result<BytesN<32>, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Agent)
        .ok_or(Error::NotInitialized)
}

pub fn set_agent(env: &Env, agent: &BytesN<32>) {
    env.storage().instance().set(&DataKey::Agent, agent);
}

pub fn policy(env: &Env) -> Result<Policy, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Policy)
        .ok_or(Error::NotInitialized)
}

pub fn set_policy(env: &Env, policy: &Policy) {
    env.storage().instance().set(&DataKey::Policy, policy);
}

/// Amount already spent in `day`. A stored state from an earlier day counts as zero.
pub fn spent_on(env: &Env, day: u64) -> i128 {
    match env
        .storage()
        .instance()
        .get::<_, SpendState>(&DataKey::Spend)
    {
        Some(state) if state.day == day => state.amount,
        _ => 0,
    }
}

pub fn set_spent(env: &Env, day: u64, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::Spend, &SpendState { day, amount });
}

/// Returns the approval for `to` if one exists and has not expired. Expired means absent.
pub fn approval(env: &Env, to: &Address) -> Option<Approval> {
    let approval: Approval = env
        .storage()
        .persistent()
        .get(&DataKey::Approval(to.clone()))?;
    if env.ledger().timestamp() < approval.expires_at {
        Some(approval)
    } else {
        None
    }
}

/// Stores an approval and keeps it alive until a day past its expiry (capped by the network).
pub fn set_approval(env: &Env, to: &Address, approval: &Approval) {
    let key = DataKey::Approval(to.clone());
    env.storage().persistent().set(&key, approval);
    let remaining = approval.expires_at.saturating_sub(env.ledger().timestamp());
    let ledgers = (remaining / SECONDS_PER_LEDGER).saturating_add(u64::from(DAY_IN_LEDGERS));
    let extend_to = u32::try_from(ledgers)
        .unwrap_or(u32::MAX)
        .min(env.storage().max_ttl());
    env.storage()
        .persistent()
        .extend_ttl(&key, extend_to, extend_to);
}

pub fn remove_approval(env: &Env, to: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Approval(to.clone()));
}
