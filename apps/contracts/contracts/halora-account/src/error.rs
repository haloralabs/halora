use soroban_sdk::contracterror;

/// Errors returned by the Halora account contract.
///
/// Codes are part of the public interface (see `docs/architecture/interfaces.md`, section 1)
/// and must never be renumbered.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Required state is missing. Should be unreachable because the constructor always runs.
    NotInitialized = 1,
    /// The signature was produced by a key that is not the configured owner or agent.
    InvalidSignature = 2,
    /// The agent tried to authorize something other than a policy-token `transfer` from this account.
    UnsupportedCall = 3,
    /// The policy is paused.
    Paused = 4,
    /// The policy has expired.
    Expired = 5,
    /// The allowlist is enabled and the recipient is not on it.
    RecipientNotAllowed = 6,
    /// A single transfer exceeds `per_tx_limit`.
    PerTxLimitExceeded = 7,
    /// The transfer would push today's total above `daily_limit`.
    DailyLimitExceeded = 8,
    /// The transfer exceeds `approval_threshold` and the owner did not co-sign.
    ApprovalRequired = 9,
    /// The supplied policy or key configuration is not valid.
    InvalidPolicy = 10,
}
