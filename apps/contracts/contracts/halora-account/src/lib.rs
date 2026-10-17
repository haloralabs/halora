//! Halora account: a Soroban custom account that lets an AI agent pay within an
//! owner-defined policy.
//!
//! The owner key may authorize anything. The agent key may only authorize
//! `policy.token.transfer(from = this account, to, amount)` calls that satisfy the policy
//! (pause, expiry, allowlist, per-transaction limit, daily limit, approval threshold).
//! See `docs/contracts/halora-account.md` for the design and threat model.
#![no_std]

mod auth;
mod error;
mod events;
mod policy;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    panic_with_error, Address, Bytes, BytesN, Env, Vec,
};

pub use error::Error;
pub use events::{AgentRotated, ApprovalRevoked, Approved, Paused, PolicyUpdated, Unpaused};
pub use policy::MAX_ALLOWLIST_LEN;
pub use types::{Approval, HaloraSignature, Policy, Signature, SpendState};

#[contract]
pub struct HaloraAccount;

#[contractimpl]
impl HaloraAccount {
    /// Initializes the account. `owner` and `agent` are ed25519 public keys.
    pub fn __constructor(
        env: Env,
        owner: BytesN<32>,
        agent: BytesN<32>,
        policy: Policy,
    ) -> Result<(), Error> {
        policy::validate_keys(&owner, &agent)?;
        policy::validate(&env, &policy)?;
        storage::set_owner(&env, &owner);
        storage::set_agent(&env, &agent);
        storage::set_policy(&env, &policy);
        storage::extend_instance(&env);
        Ok(())
    }

    /// Replaces the policy. Owner only.
    pub fn set_policy(env: Env, policy: Policy) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        policy::validate(&env, &policy)?;
        storage::set_policy(&env, &policy);
        storage::extend_instance(&env);
        events::PolicyUpdated { policy }.publish(&env);
        Ok(())
    }

    /// Rotates the agent key. Owner only.
    pub fn set_agent(env: Env, agent: BytesN<32>) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        let owner = storage::owner(&env)?;
        policy::validate_keys(&owner, &agent)?;
        storage::set_agent(&env, &agent);
        storage::extend_instance(&env);
        events::AgentRotated { agent }.publish(&env);
        Ok(())
    }

    /// Blocks every agent signature until `unpause`. Owner only.
    pub fn pause(env: Env) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        let mut policy = storage::policy(&env)?;
        policy.paused = true;
        storage::set_policy(&env, &policy);
        storage::extend_instance(&env);
        events::Paused {}.publish(&env);
        Ok(())
    }

    /// Re-enables agent signatures. Owner only.
    pub fn unpause(env: Env) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        let mut policy = storage::policy(&env)?;
        policy.paused = false;
        storage::set_policy(&env, &policy);
        storage::extend_instance(&env);
        events::Unpaused {}.publish(&env);
        Ok(())
    }

    /// Pre-approves one agent transfer above `approval_threshold` to `to`, of at most `amount`,
    /// valid until `expires_at` (unix seconds). Replaces any existing approval for `to`. The
    /// approval is consumed by the first matching agent transfer. Owner only.
    pub fn approve_payment(
        env: Env,
        to: Address,
        amount: i128,
        expires_at: u64,
    ) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        if amount <= 0 || expires_at <= env.ledger().timestamp() {
            return Err(Error::InvalidPolicy);
        }
        storage::set_approval(&env, &to, &Approval { amount, expires_at });
        storage::extend_instance(&env);
        events::Approved {
            to,
            amount,
            expires_at,
        }
        .publish(&env);
        Ok(())
    }

    /// Removes the pending approval for `to`, if any. Owner only.
    pub fn revoke_approval(env: Env, to: Address) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        storage::remove_approval(&env, &to);
        storage::extend_instance(&env);
        events::ApprovalRevoked { to }.publish(&env);
        Ok(())
    }

    pub fn owner(env: Env) -> BytesN<32> {
        storage::owner(&env).unwrap_or_else(|e| panic_with_error!(&env, e))
    }

    pub fn agent(env: Env) -> BytesN<32> {
        storage::agent(&env).unwrap_or_else(|e| panic_with_error!(&env, e))
    }

    pub fn policy(env: Env) -> Policy {
        storage::policy(&env).unwrap_or_else(|e| panic_with_error!(&env, e))
    }

    /// Amount the agent has spent in the current UTC day bucket.
    pub fn spent_today(env: Env) -> i128 {
        storage::spent_on(&env, storage::current_day(&env))
    }

    /// The pending, non-expired approval for `to`, if any.
    pub fn approval(env: Env, to: Address) -> Option<Approval> {
        storage::approval(&env, &to)
    }
}

#[contractimpl]
impl CustomAccountInterface for HaloraAccount {
    type Signature = HaloraSignature;
    type Error = Error;

    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: HaloraSignature,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let owner = storage::owner(&env)?;
        let agent = storage::agent(&env)?;
        storage::extend_instance(&env);
        let payload: Bytes = signature_payload.into();

        match signature {
            HaloraSignature::Owner(sig) => auth::verify(&env, &owner, &sig, &payload),
            HaloraSignature::Agent(sig) => {
                auth::verify(&env, &agent, &sig, &payload)?;
                auth::enforce_agent_policy(&env, &auth_contexts, false)
            }
            HaloraSignature::AgentWithOwner(agent_sig, owner_sig) => {
                auth::verify(&env, &agent, &agent_sig, &payload)?;
                auth::verify(&env, &owner, &owner_sig, &payload)?;
                auth::enforce_agent_policy(&env, &auth_contexts, true)
            }
        }
    }
}
