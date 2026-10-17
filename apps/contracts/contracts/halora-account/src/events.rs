//! Contract events. Emitted only from owner methods, never from `__check_auth`
//! (x402 facilitators reject simulations that contain non-token contract events).

use soroban_sdk::{contractevent, Address, BytesN};

use crate::types::Policy;

/// Topics `("policy_updated")`, data `Policy`.
#[contractevent(topics = ["policy_updated"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyUpdated {
    pub policy: Policy,
}

/// Topics `("agent_rotated")`, data `agent`.
#[contractevent(topics = ["agent_rotated"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentRotated {
    pub agent: BytesN<32>,
}

/// Topics `("paused")`, data `()`.
#[contractevent(topics = ["paused"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Paused {}

/// Topics `("unpaused")`, data `()`.
#[contractevent(topics = ["unpaused"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unpaused {}

/// Topics `("approved", to)`, data `(amount, expires_at)`.
#[contractevent(topics = ["approved"], data_format = "vec")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approved {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub expires_at: u64,
}

/// Topics `("approval_revoked", to)`, data `()`.
#[contractevent(topics = ["approval_revoked"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalRevoked {
    #[topic]
    pub to: Address,
}
