use soroban_sdk::{contracttype, Address, BytesN, Vec};

/// Spending policy enforced on every agent-signed authorization.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Policy {
    /// Token contract the agent may transfer (USDC Stellar Asset Contract first).
    pub token: Address,
    /// Maximum amount per single transfer, in token base units.
    pub per_tx_limit: i128,
    /// Maximum total per UTC day (bucket = ledger timestamp / 86400), in token base units.
    pub daily_limit: i128,
    /// Transfers with `amount > approval_threshold` need an owner co-signature.
    pub approval_threshold: i128,
    /// When true, the recipient must be in `allowlist`.
    pub allowlist_enabled: bool,
    /// Allowed recipients (only consulted when `allowlist_enabled` is true).
    pub allowlist: Vec<Address>,
    /// Unix seconds after which agent signatures are rejected. 0 means never.
    pub expires_at: u64,
    /// When true, every agent signature is rejected.
    pub paused: bool,
}

/// A single ed25519 signature over the Soroban authorization payload.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Signature {
    pub public_key: BytesN<32>,
    pub signature: BytesN<64>,
}

/// Credential presented to `__check_auth`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HaloraSignature {
    /// Agent key only. Subject to the full policy.
    Agent(Signature),
    /// Owner key only. Bypasses the policy and may authorize any call.
    Owner(Signature),
    /// Agent and owner co-sign. Subject to the policy, but satisfies the approval threshold.
    AgentWithOwner(Signature, Signature),
}

/// Amount spent by the agent within one UTC day bucket.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendState {
    pub day: u64,
    pub amount: i128,
}

/// One-time owner pre-approval for a single above-threshold agent transfer to a recipient.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approval {
    /// Maximum amount the approved transfer may move, in token base units.
    pub amount: i128,
    /// Unix seconds. The approval is valid while `ledger.timestamp < expires_at`.
    pub expires_at: u64,
}
