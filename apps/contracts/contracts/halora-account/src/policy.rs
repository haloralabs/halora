use soroban_sdk::{BytesN, Env};

use crate::error::Error;
use crate::types::Policy;

/// Upper bound on allowlist entries, keeping instance storage and `__check_auth` cost bounded.
pub const MAX_ALLOWLIST_LEN: u32 = 50;

/// Rejects policies that are inconsistent or would make the account behave surprisingly.
pub fn validate(env: &Env, policy: &Policy) -> Result<(), Error> {
    if policy.per_tx_limit < 0 || policy.daily_limit < 0 || policy.approval_threshold < 0 {
        return Err(Error::InvalidPolicy);
    }
    if policy.per_tx_limit > policy.daily_limit {
        return Err(Error::InvalidPolicy);
    }
    if policy.token == env.current_contract_address() {
        return Err(Error::InvalidPolicy);
    }
    if policy.allowlist.len() > MAX_ALLOWLIST_LEN {
        return Err(Error::InvalidPolicy);
    }
    if policy.allowlist_enabled && policy.allowlist.is_empty() {
        return Err(Error::InvalidPolicy);
    }
    if policy.expires_at != 0 && policy.expires_at <= env.ledger().timestamp() {
        return Err(Error::InvalidPolicy);
    }
    Ok(())
}

/// The agent key must differ from the owner key, otherwise the agent could bypass the policy.
pub fn validate_keys(owner: &BytesN<32>, agent: &BytesN<32>) -> Result<(), Error> {
    if owner == agent {
        return Err(Error::InvalidPolicy);
    }
    Ok(())
}
