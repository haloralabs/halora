#![cfg(test)]
extern crate std;

use ed25519_dalek::{Signer as _, SigningKey};
use soroban_sdk::{
    auth::{Context, ContractContext},
    symbol_short,
    testutils::{Address as _, Events as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec,
    xdr::{
        self, HashIdPreimage, HashIdPreimageSorobanAuthorization, InvokeContractArgs, Limits,
        ScSymbol, ScVal, SorobanAddressCredentials, SorobanAuthorizationEntry,
        SorobanAuthorizedFunction, SorobanAuthorizedInvocation, SorobanCredentials, VecM, WriteXdr,
    },
    Address, Bytes, BytesN, Env, IntoVal, InvokeError, Symbol, TryFromVal, Val, Vec,
};

use crate::{
    Approval, Error, HaloraAccount, HaloraAccountClient, HaloraSignature, Policy, Signature,
    MAX_ALLOWLIST_LEN,
};

const DAY: u64 = 86_400;
/// 2026-10-16T12:00:00Z, a deterministic mid-day start.
const START: u64 = 1_792_152_000;
const BALANCE: i128 = 1_000_000_000;

struct Setup {
    env: Env,
    account: Address,
    client: HaloraAccountClient<'static>,
    token: Address,
    owner: SigningKey,
    agent: SigningKey,
    merchant: Address,
    other: Address,
    nonce: i64,
}

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

fn public(env: &Env, k: &SigningKey) -> BytesN<32> {
    BytesN::from_array(env, &k.verifying_key().to_bytes())
}

fn sign(env: &Env, k: &SigningKey, payload: &BytesN<32>) -> Signature {
    let sig = k.sign(&payload.to_array());
    Signature {
        public_key: public(env, k),
        signature: BytesN::from_array(env, &sig.to_bytes()),
    }
}

/// Default policy: per tx 100, daily 250, co-sign above 50, no allowlist, no expiry.
fn base_policy(token: &Address) -> Policy {
    Policy {
        token: token.clone(),
        per_tx_limit: 100,
        daily_limit: 250,
        approval_threshold: 50,
        allowlist_enabled: false,
        allowlist: Vec::new(token.env()),
        expires_at: 0,
        paused: false,
    }
}

fn setup_with(policy_fn: impl FnOnce(&Env, &Address, &Address) -> Policy) -> Setup {
    let env = Env::default();
    env.ledger().set_timestamp(START);
    let owner = key(1);
    let agent = key(2);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = sac.address();
    let merchant = Address::generate(&env);
    let other = Address::generate(&env);

    let policy = policy_fn(&env, &token, &merchant);
    let account = env.register(
        HaloraAccount,
        (public(&env, &owner), public(&env, &agent), policy),
    );

    env.mock_all_auths();
    StellarAssetClient::new(&env, &token).mint(&account, &BALANCE);

    let client = HaloraAccountClient::new(&env, &account);
    Setup {
        env,
        account,
        client,
        token,
        owner,
        agent,
        merchant,
        other,
        nonce: 0,
    }
}

fn setup() -> Setup {
    setup_with(|_, token, _| base_policy(token))
}

fn payload(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

fn transfer_ctx(s: &Setup, to: &Address, amount: i128) -> Context {
    Context::Contract(ContractContext {
        contract: s.token.clone(),
        fn_name: symbol_short!("transfer"),
        args: (s.account.clone(), to.clone(), amount).into_val(&s.env),
    })
}

fn agent_sig(s: &Setup, p: &BytesN<32>) -> HaloraSignature {
    HaloraSignature::Agent(sign(&s.env, &s.agent, p))
}

fn owner_sig(s: &Setup, p: &BytesN<32>) -> HaloraSignature {
    HaloraSignature::Owner(sign(&s.env, &s.owner, p))
}

fn cosig(s: &Setup, p: &BytesN<32>) -> HaloraSignature {
    HaloraSignature::AgentWithOwner(sign(&s.env, &s.agent, p), sign(&s.env, &s.owner, p))
}

/// Invokes `__check_auth` directly with an arbitrary payload and contexts.
fn check(
    s: &Setup,
    p: &BytesN<32>,
    sig: HaloraSignature,
    contexts: Vec<Context>,
) -> Result<(), Result<Error, InvokeError>> {
    s.env
        .try_invoke_contract_check_auth::<Error>(&s.account, p, sig.into_val(&s.env), &contexts)
}

fn check_agent(s: &Setup, contexts: Vec<Context>) -> Result<(), Result<Error, InvokeError>> {
    let p = payload(&s.env, 7);
    check(s, &p, agent_sig(s, &p), contexts)
}

fn pay(s: &Setup, amount: i128) -> Result<(), Result<Error, InvokeError>> {
    check_agent(s, vec![&s.env, transfer_ctx(s, &s.merchant, amount)])
}

fn denied(code: Error) -> Result<(), Result<Error, InvokeError>> {
    Err(Ok(code))
}

#[derive(Clone, Copy)]
enum Who {
    Agent,
    Owner,
    AgentWithOwner,
}

/// Installs a real, signed authorization entry for `account` covering
/// `contract.fn_name(args)` as the root invocation. The host computes the same payload
/// and calls `__check_auth`, so this exercises the full on-chain auth path.
fn authorize(s: &mut Setup, signer: Who, contract: &Address, fn_name: &str, args: Vec<Val>) {
    let env = &s.env;
    s.nonce += 1;
    let expiration = env.ledger().sequence() + 100;

    let sc_args: std::vec::Vec<ScVal> = args
        .iter()
        .map(|v| ScVal::try_from_val(env, &v).unwrap())
        .collect();
    let invocation = SorobanAuthorizedInvocation {
        function: SorobanAuthorizedFunction::ContractFn(InvokeContractArgs {
            contract_address: contract.into(),
            function_name: ScSymbol(fn_name.try_into().unwrap()),
            args: VecM::try_from(sc_args).unwrap(),
        }),
        sub_invocations: VecM::default(),
    };
    let preimage = HashIdPreimage::SorobanAuthorization(HashIdPreimageSorobanAuthorization {
        network_id: xdr::Hash(env.ledger().network_id().to_array()),
        nonce: s.nonce,
        signature_expiration_ledger: expiration,
        invocation: invocation.clone(),
    });
    let preimage_bytes = Bytes::from_slice(env, &preimage.to_xdr(Limits::none()).unwrap());
    let digest: BytesN<32> = env.crypto().sha256(&preimage_bytes).into();

    let sig = match signer {
        Who::Agent => agent_sig(s, &digest),
        Who::Owner => owner_sig(s, &digest),
        Who::AgentWithOwner => cosig(s, &digest),
    };
    let sig_val: Val = sig.into_val(env);
    let entry = SorobanAuthorizationEntry {
        credentials: SorobanCredentials::Address(SorobanAddressCredentials {
            address: (&s.account).into(),
            nonce: s.nonce,
            signature_expiration_ledger: expiration,
            signature: ScVal::try_from_val(env, &sig_val).unwrap(),
        }),
        root_invocation: invocation,
    };
    env.set_auths(&[entry]);
}

fn authorize_transfer(s: &mut Setup, signer: Who, to: &Address, amount: i128) {
    let args: Vec<Val> = (s.account.clone(), to.clone(), amount).into_val(&s.env);
    let token = s.token.clone();
    authorize(s, signer, &token, "transfer", args);
}

fn balance(s: &Setup, who: &Address) -> i128 {
    TokenClient::new(&s.env, &s.token).balance(who)
}

// ---------------------------------------------------------------------------
// Constructor and views
// ---------------------------------------------------------------------------

#[test]
fn constructor_stores_state_and_views_return_it() {
    let s = setup();
    assert_eq!(s.client.owner(), public(&s.env, &s.owner));
    assert_eq!(s.client.agent(), public(&s.env, &s.agent));
    assert_eq!(s.client.policy(), base_policy(&s.token));
    assert_eq!(s.client.spent_today(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn constructor_rejects_negative_limit() {
    setup_with(|_, token, _| Policy {
        per_tx_limit: -1,
        ..base_policy(token)
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn constructor_rejects_per_tx_above_daily() {
    setup_with(|_, token, _| Policy {
        per_tx_limit: 300,
        ..base_policy(token)
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn constructor_rejects_owner_equal_to_agent() {
    let env = Env::default();
    let token = Address::generate(&env);
    let k = public(&env, &key(1));
    env.register(HaloraAccount, (k.clone(), k, base_policy(&token)));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn constructor_rejects_past_expiry() {
    setup_with(|_, token, _| Policy {
        expires_at: START - 1,
        ..base_policy(token)
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn constructor_rejects_enabled_empty_allowlist() {
    setup_with(|_, token, _| Policy {
        allowlist_enabled: true,
        ..base_policy(token)
    });
}

#[test]
fn set_policy_validation_matrix() {
    let mut s = setup();
    let base = base_policy(&s.token);
    let too_long = {
        let mut list = Vec::new(&s.env);
        for _ in 0..=MAX_ALLOWLIST_LEN {
            list.push_back(Address::generate(&s.env));
        }
        list
    };
    let invalid = [
        Policy {
            per_tx_limit: -1,
            ..base.clone()
        },
        Policy {
            daily_limit: -1,
            per_tx_limit: -1,
            ..base.clone()
        },
        Policy {
            approval_threshold: -1,
            ..base.clone()
        },
        Policy {
            per_tx_limit: 251,
            ..base.clone()
        },
        Policy {
            token: s.account.clone(),
            ..base.clone()
        },
        Policy {
            allowlist_enabled: true,
            allowlist: too_long,
            ..base.clone()
        },
        Policy {
            expires_at: START,
            ..base.clone()
        },
    ];
    for policy in invalid {
        let args: Vec<Val> = (policy.clone(),).into_val(&s.env);
        let account = s.account.clone();
        authorize(&mut s, Who::Owner, &account, "set_policy", args);
        assert_eq!(
            s.client.try_set_policy(&policy),
            Err(Ok(Error::InvalidPolicy))
        );
    }
    assert_eq!(s.client.policy(), base);
}

// ---------------------------------------------------------------------------
// Agent payments through __check_auth
// ---------------------------------------------------------------------------

#[test]
fn agent_payment_within_policy_is_allowed_and_recorded() {
    let s = setup();
    assert_eq!(pay(&s, 40), Ok(()));
    // __check_auth must not emit events (x402 facilitators reject them).
    let events = s.env.events().all().filter_by_contract(&s.account);
    assert!(events.events().is_empty());
    assert_eq!(s.client.spent_today(), 40);
}

#[test]
fn agent_payment_moves_real_tokens_end_to_end() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    authorize_transfer(&mut s, Who::Agent, &merchant, 30);
    TokenClient::new(&s.env, &s.token).transfer(&s.account, &merchant, &30);
    // The only event of a real agent payment is the token's own transfer event.
    let all = s.env.events().all();
    assert!(all.filter_by_contract(&s.account).events().is_empty());
    assert_eq!(all.filter_by_contract(&s.token).events().len(), 1);
    assert_eq!(balance(&s, &merchant), 30);
    assert_eq!(balance(&s, &s.account), BALANCE - 30);
    assert_eq!(s.client.spent_today(), 30);
}

#[test]
fn agent_payment_over_limit_fails_end_to_end() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    authorize_transfer(&mut s, Who::Agent, &merchant, 101);
    let res = TokenClient::new(&s.env, &s.token).try_transfer(&s.account, &merchant, &101);
    assert!(res.is_err());
    assert_eq!(balance(&s, &merchant), 0);
    assert_eq!(s.client.spent_today(), 0);
}

#[test]
fn paused_policy_rejects_agent() {
    let s = setup_with(|_, token, _| Policy {
        paused: true,
        ..base_policy(token)
    });
    assert_eq!(pay(&s, 10), denied(Error::Paused));
}

#[test]
fn expired_policy_rejects_agent() {
    let s = setup_with(|_, token, _| Policy {
        expires_at: START + 60,
        ..base_policy(token)
    });
    assert_eq!(pay(&s, 10), Ok(()));
    s.env.ledger().set_timestamp(START + 60);
    assert_eq!(pay(&s, 10), denied(Error::Expired));
}

#[test]
fn allowlist_blocks_unknown_recipient() {
    let s = setup_with(|env, token, merchant| Policy {
        allowlist_enabled: true,
        allowlist: vec![env, merchant.clone()],
        ..base_policy(token)
    });
    assert_eq!(pay(&s, 10), Ok(()));
    let ctx = transfer_ctx(&s, &s.other, 10);
    assert_eq!(
        check_agent(&s, vec![&s.env, ctx]),
        denied(Error::RecipientNotAllowed)
    );
}

#[test]
fn allowlist_ignored_when_disabled() {
    let s = setup_with(|env, token, merchant| Policy {
        allowlist_enabled: false,
        allowlist: vec![env, merchant.clone()],
        ..base_policy(token)
    });
    let ctx = transfer_ctx(&s, &s.other, 10);
    assert_eq!(check_agent(&s, vec![&s.env, ctx]), Ok(()));
}

#[test]
fn per_tx_limit_is_enforced_even_with_cosign() {
    let s = setup();
    let p = payload(&s.env, 9);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 101)];
    assert_eq!(
        check(&s, &p, agent_sig(&s, &p), ctx.clone()),
        denied(Error::PerTxLimitExceeded)
    );
    assert_eq!(
        check(&s, &p, cosig(&s, &p), ctx),
        denied(Error::PerTxLimitExceeded)
    );
}

#[test]
fn daily_limit_is_enforced() {
    let s = setup();
    for _ in 0..5 {
        assert_eq!(pay(&s, 50), Ok(()));
    }
    assert_eq!(s.client.spent_today(), 250);
    assert_eq!(pay(&s, 1), denied(Error::DailyLimitExceeded));
    assert_eq!(s.client.spent_today(), 250);
}

#[test]
fn daily_limit_resets_on_next_utc_day() {
    let s = setup();
    for _ in 0..5 {
        assert_eq!(pay(&s, 50), Ok(()));
    }
    assert_eq!(pay(&s, 1), denied(Error::DailyLimitExceeded));

    // Last second of the same UTC day: still blocked.
    let next_day_start = (START / DAY + 1) * DAY;
    s.env.ledger().set_timestamp(next_day_start - 1);
    assert_eq!(pay(&s, 1), denied(Error::DailyLimitExceeded));

    // First second of the next UTC day: counter is fresh.
    s.env.ledger().set_timestamp(next_day_start);
    assert_eq!(s.client.spent_today(), 0);
    assert_eq!(pay(&s, 50), Ok(()));
    assert_eq!(s.client.spent_today(), 50);

    // Several days later the counter is fresh again.
    s.env.ledger().set_timestamp(next_day_start + 3 * DAY);
    assert_eq!(s.client.spent_today(), 0);
}

#[test]
fn approval_threshold_requires_owner_cosign() {
    let s = setup();
    assert_eq!(pay(&s, 50), Ok(()));
    assert_eq!(pay(&s, 51), denied(Error::ApprovalRequired));

    let p = payload(&s.env, 3);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 80)];
    assert_eq!(check(&s, &p, cosig(&s, &p), ctx), Ok(()));
    assert_eq!(s.client.spent_today(), 130);
}

#[test]
fn cosigned_payment_moves_real_tokens_end_to_end() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    authorize_transfer(&mut s, Who::AgentWithOwner, &merchant, 90);
    TokenClient::new(&s.env, &s.token).transfer(&s.account, &merchant, &90);
    assert_eq!(balance(&s, &merchant), 90);
    assert_eq!(s.client.spent_today(), 90);
}

#[test]
fn cosign_does_not_bypass_pause_or_daily_limit() {
    let s = setup_with(|_, token, _| Policy {
        paused: true,
        ..base_policy(token)
    });
    let p = payload(&s.env, 4);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 10)];
    assert_eq!(check(&s, &p, cosig(&s, &p), ctx), denied(Error::Paused));

    let s = setup();
    let p = payload(&s.env, 4);
    let ctx = vec![
        &s.env,
        transfer_ctx(&s, &s.merchant, 100),
        transfer_ctx(&s, &s.merchant, 100),
        transfer_ctx(&s, &s.merchant, 100),
    ];
    assert_eq!(
        check(&s, &p, cosig(&s, &p), ctx),
        denied(Error::DailyLimitExceeded)
    );
}

#[test]
fn multiple_transfer_contexts_are_summed() {
    let s = setup();
    let ok = vec![
        &s.env,
        transfer_ctx(&s, &s.merchant, 50),
        transfer_ctx(&s, &s.other, 50),
    ];
    assert_eq!(check_agent(&s, ok), Ok(()));
    let events = s.env.events().all().filter_by_contract(&s.account);
    assert!(events.events().is_empty());
    assert_eq!(s.client.spent_today(), 100);

    // 100 already spent, 50 + 50 + 50 would reach 250 (ok) but four would exceed it.
    let too_much = vec![
        &s.env,
        transfer_ctx(&s, &s.merchant, 50),
        transfer_ctx(&s, &s.merchant, 50),
        transfer_ctx(&s, &s.merchant, 50),
        transfer_ctx(&s, &s.merchant, 50),
    ];
    assert_eq!(check_agent(&s, too_much), denied(Error::DailyLimitExceeded));
    // A rejected authorization records nothing.
    assert_eq!(s.client.spent_today(), 100);
}

#[test]
fn one_bad_context_rejects_the_whole_authorization() {
    let s = setup();
    let set_policy_ctx = Context::Contract(ContractContext {
        contract: s.account.clone(),
        fn_name: Symbol::new(&s.env, "set_policy"),
        args: (base_policy(&s.token),).into_val(&s.env),
    });
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 10), set_policy_ctx];
    assert_eq!(check_agent(&s, ctx), denied(Error::UnsupportedCall));
    assert_eq!(s.client.spent_today(), 0);
}

// ---------------------------------------------------------------------------
// UnsupportedCall: the agent may only sign token transfers from this account
// ---------------------------------------------------------------------------

#[test]
fn agent_cannot_sign_other_token() {
    let s = setup();
    let other_token = s
        .env
        .register_stellar_asset_contract_v2(Address::generate(&s.env))
        .address();
    let ctx = Context::Contract(ContractContext {
        contract: other_token,
        fn_name: symbol_short!("transfer"),
        args: (s.account.clone(), s.merchant.clone(), 10_i128).into_val(&s.env),
    });
    assert_eq!(
        check_agent(&s, vec![&s.env, ctx]),
        denied(Error::UnsupportedCall)
    );
}

#[test]
fn agent_cannot_sign_other_token_functions() {
    let s = setup();
    for name in ["approve", "burn", "transfer_from", "set_admin"] {
        let ctx = Context::Contract(ContractContext {
            contract: s.token.clone(),
            fn_name: Symbol::new(&s.env, name),
            args: (s.account.clone(), s.merchant.clone(), 10_i128).into_val(&s.env),
        });
        assert_eq!(
            check_agent(&s, vec![&s.env, ctx]),
            denied(Error::UnsupportedCall)
        );
    }
}

#[test]
fn agent_cannot_sign_malformed_transfer() {
    let s = setup();
    let cases: [Vec<Val>; 5] = [
        // from is not this account
        (s.other.clone(), s.merchant.clone(), 10_i128).into_val(&s.env),
        // wrong arity
        (s.account.clone(), s.merchant.clone()).into_val(&s.env),
        // wrong amount type
        (s.account.clone(), s.merchant.clone(), 10_u32).into_val(&s.env),
        // zero amount
        (s.account.clone(), s.merchant.clone(), 0_i128).into_val(&s.env),
        // negative amount would otherwise reduce the daily counter
        (s.account.clone(), s.merchant.clone(), -10_i128).into_val(&s.env),
    ];
    for args in cases {
        let ctx = Context::Contract(ContractContext {
            contract: s.token.clone(),
            fn_name: symbol_short!("transfer"),
            args,
        });
        assert_eq!(
            check_agent(&s, vec![&s.env, ctx]),
            denied(Error::UnsupportedCall)
        );
    }
}

#[test]
fn agent_with_empty_contexts_is_rejected() {
    let s = setup();
    assert_eq!(
        check_agent(&s, Vec::new(&s.env)),
        denied(Error::UnsupportedCall)
    );
}

#[test]
fn agent_cannot_call_set_policy_end_to_end() {
    let mut s = setup();
    let generous = Policy {
        per_tx_limit: BALANCE,
        daily_limit: BALANCE,
        approval_threshold: BALANCE,
        ..base_policy(&s.token)
    };
    let args: Vec<Val> = (generous.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Agent, &account, "set_policy", args.clone());
    assert!(s.client.try_set_policy(&generous).is_err());

    // Even with the owner co-signing alongside the agent, admin calls stay owner-only.
    authorize(&mut s, Who::AgentWithOwner, &account, "set_policy", args);
    assert!(s.client.try_set_policy(&generous).is_err());

    assert_eq!(s.client.policy(), base_policy(&s.token));
}

#[test]
fn agent_cannot_pause_unpause_or_rotate() {
    let mut s = setup();
    let account = s.account.clone();
    let empty: Vec<Val> = Vec::new(&s.env);

    authorize(&mut s, Who::Agent, &account, "unpause", empty.clone());
    assert!(s.client.try_unpause().is_err());

    authorize(&mut s, Who::Agent, &account, "pause", empty);
    assert!(s.client.try_pause().is_err());

    let new_agent = public(&s.env, &key(9));
    let args: Vec<Val> = (new_agent.clone(),).into_val(&s.env);
    authorize(&mut s, Who::Agent, &account, "set_agent", args);
    assert!(s.client.try_set_agent(&new_agent).is_err());
    assert_eq!(s.client.agent(), public(&s.env, &s.agent));
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

#[test]
fn signature_from_unknown_key_is_rejected() {
    let s = setup();
    let p = payload(&s.env, 5);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 10)];
    let stranger = key(42);

    let as_agent = HaloraSignature::Agent(sign(&s.env, &stranger, &p));
    assert_eq!(
        check(&s, &p, as_agent, ctx.clone()),
        denied(Error::InvalidSignature)
    );
    let as_owner = HaloraSignature::Owner(sign(&s.env, &stranger, &p));
    assert_eq!(
        check(&s, &p, as_owner, ctx.clone()),
        denied(Error::InvalidSignature)
    );
    // Agent key presented as owner (and vice versa) is rejected.
    let swapped = HaloraSignature::Owner(sign(&s.env, &s.agent, &p));
    assert_eq!(
        check(&s, &p, swapped, ctx.clone()),
        denied(Error::InvalidSignature)
    );
    let both_agent =
        HaloraSignature::AgentWithOwner(sign(&s.env, &s.agent, &p), sign(&s.env, &s.agent, &p));
    assert_eq!(
        check(&s, &p, both_agent, ctx),
        denied(Error::InvalidSignature)
    );
}

#[test]
fn signature_over_other_payload_is_rejected() {
    let s = setup();
    let p = payload(&s.env, 5);
    let wrong = payload(&s.env, 6);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 10)];

    let res = check(&s, &p, agent_sig(&s, &wrong), ctx.clone());
    assert!(matches!(res, Err(Err(_))), "unexpected: {res:?}");

    let res = check(&s, &p, owner_sig(&s, &wrong), ctx);
    assert!(matches!(res, Err(Err(_))), "unexpected: {res:?}");
    assert_eq!(s.client.spent_today(), 0);
}

#[test]
fn replayed_auth_entry_is_rejected() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    authorize_transfer(&mut s, Who::Agent, &merchant, 10);
    let token = TokenClient::new(&s.env, &s.token);
    token.transfer(&s.account, &merchant, &10);
    // Same entry (same nonce) is still installed, the host must refuse to reuse it.
    assert!(token.try_transfer(&s.account, &merchant, &10).is_err());
    assert_eq!(balance(&s, &merchant), 10);
}

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

#[test]
fn owner_bypasses_policy() {
    let s = setup_with(|env, token, merchant| Policy {
        paused: true,
        allowlist_enabled: true,
        allowlist: vec![env, merchant.clone()],
        expires_at: START + 1,
        ..base_policy(token)
    });
    s.env.ledger().set_timestamp(START + 10);
    let p = payload(&s.env, 8);
    let any_call = Context::Contract(ContractContext {
        contract: s.token.clone(),
        fn_name: Symbol::new(&s.env, "approve"),
        args: Vec::new(&s.env),
    });
    let ctx = vec![&s.env, transfer_ctx(&s, &s.other, BALANCE), any_call];
    assert_eq!(check(&s, &p, owner_sig(&s, &p), ctx), Ok(()));
    // Owner spends are not counted against the agent's daily limit.
    assert_eq!(s.client.spent_today(), 0);
}

#[test]
fn owner_withdraws_end_to_end() {
    let mut s = setup();
    let other = s.other.clone();
    authorize_transfer(&mut s, Who::Owner, &other, BALANCE);
    TokenClient::new(&s.env, &s.token).transfer(&s.account, &other, &BALANCE);
    assert_eq!(balance(&s, &other), BALANCE);
}

#[test]
fn owner_sets_policy_end_to_end() {
    let mut s = setup();
    let new_policy = Policy {
        per_tx_limit: 10,
        daily_limit: 20,
        approval_threshold: 5,
        ..base_policy(&s.token)
    };
    let args: Vec<Val> = (new_policy.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Owner, &account, "set_policy", args);
    s.client.set_policy(&new_policy);
    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> = (Symbol::new(&s.env, "policy_updated"),).into_val(&s.env);
    let data: Val = new_policy.clone().into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, data)]);
    assert_eq!(s.client.policy(), new_policy);

    assert_eq!(pay(&s, 11), denied(Error::PerTxLimitExceeded));
    assert_eq!(pay(&s, 6), denied(Error::ApprovalRequired));
    assert_eq!(pay(&s, 5), Ok(()));
}

#[test]
fn owner_pause_and_unpause_end_to_end() {
    let mut s = setup();
    let account = s.account.clone();
    let empty: Vec<Val> = Vec::new(&s.env);

    authorize(&mut s, Who::Owner, &account, "pause", empty.clone());
    s.client.pause();
    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> = (symbol_short!("paused"),).into_val(&s.env);
    let unit: Val = ().into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, unit)]);
    assert!(s.client.policy().paused);
    assert_eq!(pay(&s, 10), denied(Error::Paused));

    authorize(&mut s, Who::Owner, &account, "unpause", empty);
    s.client.unpause();
    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> = (symbol_short!("unpaused"),).into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, unit)]);
    assert!(!s.client.policy().paused);
    assert_eq!(pay(&s, 10), Ok(()));
}

#[test]
fn owner_rotates_agent_end_to_end() {
    let mut s = setup();
    let new_key = key(9);
    let new_agent = public(&s.env, &new_key);
    let args: Vec<Val> = (new_agent.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Owner, &account, "set_agent", args);
    s.client.set_agent(&new_agent);
    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> = (Symbol::new(&s.env, "agent_rotated"),).into_val(&s.env);
    let data: Val = new_agent.clone().into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, data)]);
    assert_eq!(s.client.agent(), new_agent);

    // Old agent key no longer works, the new one does.
    assert_eq!(pay(&s, 10), denied(Error::InvalidSignature));
    let p = payload(&s.env, 11);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.merchant, 10)];
    let sig = HaloraSignature::Agent(sign(&s.env, &new_key, &p));
    assert_eq!(check(&s, &p, sig, ctx), Ok(()));
}

#[test]
fn owner_cannot_set_agent_to_owner_key() {
    let mut s = setup();
    let owner_key = public(&s.env, &s.owner);
    let args: Vec<Val> = (owner_key.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Owner, &account, "set_agent", args);
    assert_eq!(
        s.client.try_set_agent(&owner_key),
        Err(Ok(Error::InvalidPolicy))
    );
}

#[test]
fn spent_today_survives_policy_update() {
    let mut s = setup();
    assert_eq!(pay(&s, 50), Ok(()));
    let new_policy = Policy {
        daily_limit: 60,
        per_tx_limit: 60,
        ..base_policy(&s.token)
    };
    let args: Vec<Val> = (new_policy.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Owner, &account, "set_policy", args);
    s.client.set_policy(&new_policy);
    assert_eq!(s.client.spent_today(), 50);
    assert_eq!(pay(&s, 11), denied(Error::DailyLimitExceeded));
    assert_eq!(pay(&s, 10), Ok(()));
}

// ---------------------------------------------------------------------------
// Pre-approvals
// ---------------------------------------------------------------------------

fn approve(s: &mut Setup, to: &Address, amount: i128, expires_at: u64) {
    let args: Vec<Val> = (to.clone(), amount, expires_at).into_val(&s.env);
    let account = s.account.clone();
    authorize(s, Who::Owner, &account, "approve_payment", args);
    s.client.approve_payment(to, &amount, &expires_at);
}

#[test]
fn approval_is_consumed_by_one_payment() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 80, START + 600);

    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> = (Symbol::new(&s.env, "approved"), merchant.clone()).into_val(&s.env);
    let data: Val = (80_i128, START + 600).into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, data)]);
    assert_eq!(
        s.client.approval(&merchant),
        Some(Approval {
            amount: 80,
            expires_at: START + 600
        })
    );

    assert_eq!(pay(&s, 80), Ok(()));
    assert_eq!(s.client.approval(&merchant), None);
    assert_eq!(pay(&s, 80), denied(Error::ApprovalRequired));
    assert_eq!(s.client.spent_today(), 80);
}

#[test]
fn approved_payment_moves_real_tokens_end_to_end() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 90, START + 600);
    authorize_transfer(&mut s, Who::Agent, &merchant, 90);
    TokenClient::new(&s.env, &s.token).transfer(&s.account, &merchant, &90);
    assert!(s
        .env
        .events()
        .all()
        .filter_by_contract(&s.account)
        .events()
        .is_empty());
    assert_eq!(balance(&s, &merchant), 90);
    assert_eq!(s.client.approval(&merchant), None);
}

#[test]
fn approval_covers_one_transfer_per_authorization() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 80, START + 600);
    let ctx = vec![
        &s.env,
        transfer_ctx(&s, &merchant, 60),
        transfer_ctx(&s, &merchant, 60),
    ];
    assert_eq!(check_agent(&s, ctx), denied(Error::ApprovalRequired));
    // Rejected authorization leaves the approval in place.
    assert!(s.client.approval(&merchant).is_some());
}

#[test]
fn expired_approval_is_rejected() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 80, START + 60);
    s.env.ledger().set_timestamp(START + 60);
    assert_eq!(s.client.approval(&merchant), None);
    assert_eq!(pay(&s, 80), denied(Error::ApprovalRequired));
}

#[test]
fn amount_above_approval_is_rejected() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 70, START + 600);
    assert_eq!(pay(&s, 71), denied(Error::ApprovalRequired));
    assert!(s.client.approval(&merchant).is_some());
    assert_eq!(pay(&s, 70), Ok(()));
}

#[test]
fn approval_is_per_recipient_and_limits_still_apply() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 500, START + 600);
    let ctx = vec![&s.env, transfer_ctx(&s, &s.other, 60)];
    assert_eq!(check_agent(&s, ctx), denied(Error::ApprovalRequired));
    assert_eq!(pay(&s, 101), denied(Error::PerTxLimitExceeded));
}

#[test]
fn new_approval_replaces_old() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 90, START + 600);
    approve(&mut s, &merchant, 60, START + 300);
    assert_eq!(
        s.client.approval(&merchant),
        Some(Approval {
            amount: 60,
            expires_at: START + 300
        })
    );
    assert_eq!(pay(&s, 90), denied(Error::ApprovalRequired));
}

#[test]
fn revoke_approval_works() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    approve(&mut s, &merchant, 80, START + 600);
    let args: Vec<Val> = (merchant.clone(),).into_val(&s.env);
    let account = s.account.clone();
    authorize(&mut s, Who::Owner, &account, "revoke_approval", args);
    s.client.revoke_approval(&merchant);
    let events = s.env.events().all().filter_by_contract(&s.account);
    let topics: Vec<Val> =
        (Symbol::new(&s.env, "approval_revoked"), merchant.clone()).into_val(&s.env);
    let unit: Val = ().into_val(&s.env);
    assert_eq!(events, vec![&s.env, (s.account.clone(), topics, unit)]);
    assert_eq!(s.client.approval(&merchant), None);
    assert_eq!(pay(&s, 80), denied(Error::ApprovalRequired));
}

#[test]
fn approve_payment_validates_input() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    let account = s.account.clone();
    for (amount, expires_at) in [(0_i128, START + 600), (-5, START + 600), (80, START)] {
        let args: Vec<Val> = (merchant.clone(), amount, expires_at).into_val(&s.env);
        authorize(&mut s, Who::Owner, &account, "approve_payment", args);
        assert_eq!(
            s.client
                .try_approve_payment(&merchant, &amount, &expires_at),
            Err(Ok(Error::InvalidPolicy))
        );
    }
    assert_eq!(s.client.approval(&merchant), None);
}

#[test]
fn agent_cannot_approve_or_revoke() {
    let mut s = setup();
    let merchant = s.merchant.clone();
    let account = s.account.clone();
    let args: Vec<Val> = (merchant.clone(), 80_i128, START + 600).into_val(&s.env);
    authorize(
        &mut s,
        Who::Agent,
        &account,
        "approve_payment",
        args.clone(),
    );
    assert!(s
        .client
        .try_approve_payment(&merchant, &80, &(START + 600))
        .is_err());
    authorize(
        &mut s,
        Who::AgentWithOwner,
        &account,
        "approve_payment",
        args,
    );
    assert!(s
        .client
        .try_approve_payment(&merchant, &80, &(START + 600))
        .is_err());
    assert_eq!(s.client.approval(&merchant), None);

    approve(&mut s, &merchant, 80, START + 600);
    let args: Vec<Val> = (merchant.clone(),).into_val(&s.env);
    authorize(&mut s, Who::Agent, &account, "revoke_approval", args);
    assert!(s.client.try_revoke_approval(&merchant).is_err());
    assert!(s.client.approval(&merchant).is_some());
}
