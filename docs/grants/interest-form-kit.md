# Kit para el formulario de interés del SCF

Textos listos para copiar en [communityfund.stellar.org](https://communityfund.stellar.org). Los campos del formulario pueden cambiar; usa el texto que más se parezca a cada pregunta. Lo que va entre corchetes lo completas tú.

## Datos básicos

- **Project name:** Halora
- **Track:** Open Track
- **Website:** [URL pública de la landing, cuando esté publicada]
- **Repository:** [https://github.com/haloralabs/halora, cuando esté público]
- **Contact:** [tu nombre y correo]
- **Referral code:** [si alguien de la comunidad Stellar te refiere]

## One-liner (una línea)

Halora gives AI agents a Stellar wallet with rules they cannot break: per-payment and daily limits, allowlists and owner approvals, enforced on-chain by a Soroban account contract, with native x402 support.

## Short description (2 a 4 frases)

AI agents increasingly pay for APIs and data on their own, but today they either need a human-managed card per service or a plain wallet that a prompt injection can drain. Halora deploys a Soroban custom account per agent whose `__check_auth` enforces the owner's policy on every payment, so a manipulated or buggy agent can never spend more than allowed. It ships with a TypeScript SDK, an MCP server, an approvals API and an owner dashboard.

## What already works (evidencia verificable, 2026-10-19)

- `halora-account` deployed on Stellar testnet (WASM hash `4df8f36c...c5ff`), 48 contract tests passing.
- End to end on testnet through the SDK: allowed payment settles, above-threshold payment is held and settles after the owner's on-chain approval, and the contract itself refuses over-limit payments (`PerTxLimitExceeded`) and unknown recipients (`RecipientNotAllowed`).
- **x402 on Stellar works with a Halora account as payer:** the public facilitator verified and settled the payment (testnet tx `63ddfed18c80bf335075a0f0cb8b88e233dd22aeba5b27d2f95cc4cf63edc01d`).
- The MCP server lets an agent such as Claude check its budget and pay; refusals come with instructions not to retry or work around them.
- Details: `docs/deployment/testnet.md` in the repository.

## Why Stellar

Sub-cent fees and about 5 second finality make per-request payments viable; native USDC through the Stellar Asset Contract; Soroban custom accounts let the account itself decide what a signature may authorize; and x402 is live on Stellar with fee-sponsoring facilitators, so agents need no XLM.

## Ask

USD 72,000 over 5 months (Open Track), milestone-based: T1 testnet MVP, T2 testnet product with threat model and monitoring, T3 mainnet launch with tested onboarding. Full draft: `docs/grants/scf-application.md`.

## Antes de enviar

- [ ] Completar equipo, tarifas y la declaración de uso de IA en `scf-application.md`.
- [ ] Repo público y landing publicada (para poder pegar los enlaces).
- [ ] Video corto (1 a 2 minutos) mostrando la terminal de la landing y el pago x402.
