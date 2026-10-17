//! Signature verification and agent policy enforcement used by `__check_auth`.

use soroban_sdk::{auth::Context, symbol_short, Address, Bytes, BytesN, Env, TryFromVal, Val, Vec};

use crate::error::Error;
use crate::storage;
use crate::types::{Policy, Signature};

/// Checks that `sig` was made by `expected` over `payload`.
///
/// A key mismatch returns `InvalidSignature`. A cryptographically invalid signature makes the
/// host trap inside `ed25519_verify`, which also denies the authorization.
pub fn verify(
    env: &Env,
    expected: &BytesN<32>,
    sig: &Signature,
    payload: &Bytes,
) -> Result<(), Error> {
    if sig.public_key != *expected {
        return Err(Error::InvalidSignature);
    }
    env.crypto()
        .ed25519_verify(&sig.public_key, payload, &sig.signature);
    Ok(())
}

/// Decodes one auth context as `policy.token.transfer(from = this, to, amount)`.
///
/// Anything else, including a muxed destination or a non-positive amount, is `UnsupportedCall`.
fn parse_transfer(
    env: &Env,
    ctx: &Context,
    token: &Address,
    this: &Address,
) -> Result<(Address, i128), Error> {
    let Context::Contract(call) = ctx else {
        return Err(Error::UnsupportedCall);
    };
    if call.contract != *token || call.fn_name != symbol_short!("transfer") {
        return Err(Error::UnsupportedCall);
    }
    if call.args.len() != 3 {
        return Err(Error::UnsupportedCall);
    }
    let from = arg::<Address>(env, &call.args, 0)?;
    let to = arg::<Address>(env, &call.args, 1)?;
    let amount = arg::<i128>(env, &call.args, 2)?;
    if from != *this || amount <= 0 {
        return Err(Error::UnsupportedCall);
    }
    Ok((to, amount))
}

fn arg<T: TryFromVal<Env, Val>>(env: &Env, args: &Vec<Val>, index: u32) -> Result<T, Error> {
    let val = args.get(index).ok_or(Error::UnsupportedCall)?;
    T::try_from_val(env, &val).map_err(|_| Error::UnsupportedCall)
}

/// Enforces the policy for an agent-signed authorization and records the spend.
///
/// Order of checks: every context must be a supported transfer, then paused, expired, and for
/// each transfer: allowlist, per-transaction limit, daily limit (cumulative across all transfers
/// in this authorization), approval threshold (owner co-signature or a one-time pre-approval
/// for the recipient, consumed on use).
///
/// No events are emitted here: x402 facilitators reject simulations that contain contract
/// events other than the token's own `transfer` event.
pub fn enforce_agent_policy(
    env: &Env,
    auth_contexts: &Vec<Context>,
    owner_cosigned: bool,
) -> Result<(), Error> {
    let policy: Policy = storage::policy(env)?;
    let this = env.current_contract_address();

    if auth_contexts.is_empty() {
        return Err(Error::UnsupportedCall);
    }
    let mut transfers: Vec<(Address, i128)> = Vec::new(env);
    for ctx in auth_contexts.iter() {
        transfers.push_back(parse_transfer(env, &ctx, &policy.token, &this)?);
    }

    if policy.paused {
        return Err(Error::Paused);
    }
    if policy.expires_at != 0 && env.ledger().timestamp() >= policy.expires_at {
        return Err(Error::Expired);
    }

    let day = storage::current_day(env);
    let mut spent = storage::spent_on(env, day);
    let mut consumed: Vec<Address> = Vec::new(env);
    for (to, amount) in transfers.iter() {
        if policy.allowlist_enabled && !policy.allowlist.contains(&to) {
            return Err(Error::RecipientNotAllowed);
        }
        if amount > policy.per_tx_limit {
            return Err(Error::PerTxLimitExceeded);
        }
        let next = spent.checked_add(amount).ok_or(Error::DailyLimitExceeded)?;
        if next > policy.daily_limit {
            return Err(Error::DailyLimitExceeded);
        }
        if amount > policy.approval_threshold && !owner_cosigned {
            // An approval is single use, so a second transfer to the same recipient in this
            // authorization cannot reuse it.
            let approved = !consumed.contains(&to)
                && storage::approval(env, &to).is_some_and(|a| amount <= a.amount);
            if !approved {
                return Err(Error::ApprovalRequired);
            }
            consumed.push_back(to.clone());
        }
        spent = next;
    }

    // All checks passed: only now write state.
    storage::set_spent(env, day, spent);
    for to in consumed.iter() {
        storage::remove_approval(env, &to);
    }
    Ok(())
}
