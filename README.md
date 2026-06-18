# StellarPad

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](https://github.com/StellarPad/StellarPad-backend/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Coverage](https://img.shields.io/badge/coverage-NA-lightgrey)](#)

A decentralized real estate marketplace bridging Web2 usability with Stellar/Soroban infrastructure for escrowed property reservations, tokenized rental flows, and instant split settlement.

## Overview

StellarPad is a production-focused decentralized property marketplace designed to bring Zillow-style discovery and Amazon-grade checkout flow to blockchain-native real estate. The platform solves the traditional middleman and settlement friction in property rentals by using Soroban smart contracts, escrow tokenization, and stablecoin settlements on Stellar.

By combining a Web2-style user experience with a Web3 backend, StellarPad enables:

- frictionless property reservations backed by on-chain escrow,
- native instant split settlement between owners, managers, and platform operators,
- off-chain query performance with on-chain integrity via Soroban event ingestion.

Stellar/Soroban is the ideal backbone because it delivers low-cost, deterministic smart contract execution with fast finality, integrated stablecoin rails, and support for composable token flows that match real estate settlement requirements.

## Features

- Tokenized property listings with structured attributes and metadata URIs
- Gasless-friendly reservation flow via passkey/silent wallet session brokering
- Fiat-to-stablecoin conversion service for seamless on-ramp payments
- Atomic escrow lifecycle for reservation deposit, claim, release, and dispute
- Instant split settlement between landlord, property manager, and platform fee pool
- Soroban event ingestion and off-chain indexer for real-time dashboard analytics
- Role-based access: Landlord, Tenant, Platform Admin
- Built-in rate and USD pricing support for stablecoin-denominated offers
- Secure backend API with request telemetry, compression, and strict error handling

## Architecture

```mermaid
graph TB
  User[User]
  Frontend[Frontend Client]
  Backend[Backend API]
  PaymentLayer[Fiat / Stablecoin / Wallet]
  Soroban[Smart Contracts]
  Horizon[Stellar Horizon]
  IPFS[IPFS / Pinata]
  PostgreSQL[PostgreSQL / Prisma]

  User -->|Web UI / Mobile UX| Frontend
  Frontend -->|REST / GraphQL| Backend
  Backend -->|RPC / XDR| Horizon
  Backend -->|Event Polling| Soroban
  Backend -->|DB Writes| PostgreSQL
  Backend -->|Metadata Upload| IPFS
  Frontend -->|Wallet Request| PaymentLayer
  PaymentLayer -->|Stablecoin Transfer| Soroban
  Soroban -->|Events / Logs| Horizon
  Soroban -->|Asset Metadata| IPFS
  PaymentLayer -->|Signature Relay| Horizon

  subgraph DataFlow
    Frontend --> Backend
    Backend --> PostgreSQL
    Backend --> Horizon
    Horizon --> Soroban
    Soroban --> IPFS
  end
```

### Core Components

- `src/app.ts` — Express app bootstrap with middleware, route registration, and performance tuning.
- `src/index.ts` — Server entry point and HTTP listener.
- `src/config/env.ts` — Environment-driven configuration for Stellar, database, and API layers.
- `src/services/stellar.service.ts` — Soroban/Horizon helpers and XDR transaction generation.
- `src/services/exchange.service.ts` — Fiat-to-stablecoin quote and conversion logic.
- `src/workers/ingestion.worker.ts` — Event polling loop for Soroban transaction ingestion.
- `src/workers/event.parser.ts` — Soroban event decoding and domain mapping.
- `src/workers/handlers/listing.handler.ts` — Listing creation and update event processing.
- `src/workers/handlers/reservation.handler.ts` — Reservation lifecycle and escrow handling.
- `prisma/schema.prisma` — Domain model for listings, reservations, escrows, users, and event cursors.

### Fee / Split Distribution Model

| Recipient | Allocation | Description |
|---|---|---|
| Landlord | 70% | Primary property revenue share |
| Property Manager | 20% | Operations, upkeep, and booking support |
| Platform | 8% | Marketplace fee for escrow and settlement services |
| Reserve / Insurance | 2% | Dispute buffer or liquidity reserve |

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Backend API | Node.js, TypeScript, Express | Server-side REST API, validation, middleware, and orchestration |
| Database | PostgreSQL, Prisma ORM | Transactional storage, event cursoring, and analytics data |
| Blockchain | Stellar, Soroban | Smart contract execution, escrow lifecycle, and event-driven settlement |
| Wallet / Payments | Soroban token transfers, USDC stablecoin | On-chain asset movement and stable token settlement |
| Metadata Storage | IPFS, Pinata | Off-chain metadata hosting for listings and property assets |
| Authentication | Passkey / silent wallet integration | Passwordless UX and wallet session brokering |
| Logging | morgan, structured error middleware | Request telemetry, auditability, and incident diagnosis |

## Smart Contract Functions

### Landlord / Creator

- `mint_property(token_id, metadata_uri, splits, owner_address)`
- `publish_listing(listing_id, price_usdc, availability_days)`
- `update_property_metadata(token_id, metadata_uri)`
- `set_reservation_terms(listing_id, min_stay, max_stay, refundable_deposit)`

### Tenant / Buyer

- `reserve_listing(listing_id, deposit_amount, tenant_address)`
- `confirm_checkin(reservation_id, proof_uri)`
- `checkout_and_settle(reservation_id, payment_amount)`
- `raise_dispute(reservation_id, reason_code)`

### Admin

- `pause_contract()`
- `unpause_contract()`
- `update_fee_structure(platform_fee_bps, manager_fee_bps)`
- `resolve_dispute(reservation_id, resolution_code)`
- `withdraw_platform_fees(destination_address)`

### Query / Read-only

- `get_listing(listing_id)`
- `get_reservation(reservation_id)`
- `get_active_reservations(owner_address)`
- `get_split_allocation(token_id)`
- `get_contract_state()`

## Lifecycle Diagrams

### Reservation Flow Sequence

```mermaid
sequenceDiagram
  actor Tenant
  participant UI as Frontend
  participant API as Backend
  participant DB as PostgreSQL
  participant Horizon as Stellar Horizon
  participant SC as Soroban Contract
  participant IPFS as IPFS

  Tenant->>UI: Browse listings
  UI->>API: GET /listings
  API->>DB: Read listings
  DB-->>API: Listings data
  API-->>UI: Listing payload
  Tenant->>UI: Reserve property
  UI->>API: POST /reservations
  API->>Horizon: Build reservation XDR
  Horizon->>SC: Submit transaction
  SC-->>Horizon: Emit reservation event
  Horizon->>API: Event notification
  API->>DB: Persist reservation + escrow state
  API-->>UI: Reservation confirmed
  SC->>SC: Lock escrow until settlement
  Tenant->>UI: Complete checkout
  UI->>API: POST /reservations/{id}/checkout
  API->>SC: Release escrow and split funds
  SC-->>Horizon: Emit payout event
  API->>DB: Update reservation state
  API-->>UI: Settlement complete
```

### Asset State Machine

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Published : publish_listing()
  Published --> Reserved : reserve_listing()
  Reserved --> CheckedIn : confirm_checkin()
  CheckedIn --> Settled : checkout_and_settle()
  Reserved --> Disputed : raise_dispute()
  Disputed --> Settled : resolve_dispute()
  Settled --> Archived : archive_reservation()
```

### Valid Transitions

| From | To | Trigger |
|---|---|---|
| Draft | Published | `publish_listing()` |
| Published | Reserved | `reserve_listing()` |
| Reserved | CheckedIn | `confirm_checkin()` |
| CheckedIn | Settled | `checkout_and_settle()` |
| Reserved | Disputed | `raise_dispute()` |
| Disputed | Settled | `resolve_dispute()` |
| Settled | Archived | `archive_reservation()` |

## Security Features

1. Atomic escrow settlement through Soroban contract execution.
2. Immutable contract parameters for fee and split logic.
3. Overflow-safe token math with checked arithmetic in all payment flows.
4. Role-based access controls for landlords, tenants, and admins.
5. Emergency pause/unpause for fast circuit breaker response.
6. Token-gated metadata access and on-chain wallet authorization.
7. Strict backend validation for XDR payloads and user-submitted metadata.
8. Event idempotency guard using on-chain event cursoring and `IngestedEvent` deduplication.

## Quick Start & Setup

### One-shot test network bootstrap

```bash
git clone https://github.com/StellarPad/StellarPad-backend.git
cd StellarPad-backend
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

### Manual setup

```bash
# 1) Install dependencies
npm install

# 2) Generate Prisma client
npm run db:generate

# 3) Compile backend
npm run build

# 4) Deploy Soroban contracts
# (contract deployment script / CLI commands defined outside backend repo)

# 5) Initialize contract state
# Use the backend API to register platform config, fee parameters, and stablecoin mint settings.

# 6) Launch frontend
# Start the frontend app in its repository root:
# npm install && npm run dev
```

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/stellarpad` |
| `PORT` | Backend HTTP port | `4000` |
| `NODE_ENV` | Runtime environment | `development` |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://rpc-futurenet.stellar.org` |
| `HORIZON_URL` | Stellar Horizon endpoint | `https://horizon-futurenet.stellar.org` |
| `STABLECOIN_ASSET_CODE` | Primary stablecoin code | `USDC` |
| `STABLECOIN_ISSUER` | Stablecoin issuer account | `G...ISSUER...` |
| `PINATA_API_KEY` | IPFS pinning API key | `` |
| `PINATA_SECRET_API_KEY` | IPFS secret API key | `` |
| `JWT_SECRET` | JWT secret for backend auth | `` |
| `LOG_LEVEL` | Server log verbosity | `info` |

## Testing & MVP Scope

### Run tests

```bash
# Backend unit and integration tests
npm test

# Smart contract tests
# Use the smart contract workspace / directory for `cargo test` or `forge test`
```

### MVP Scope

- On-chain reservation escrow with stablecoin collateral
- Tokenized listing lifecycle and metadata management
- Passkey-friendly Web3 authentication and silent wallet orchestration
- Backend event ingestion and analytics-ready persistence
- Admin fee configuration and dispute resolution primitives

### Future milestones

- Secondary resale marketplace with perpetual royalties
- Cross-marketplace token gating and DRM-style access
- Multichain settlement bridges and LP-backed liquidity contracts
- Mobile-first walletless onboarding

## Error Codes & Events

### Smart Contract Error Codes

| Code | Error Name | Description | Common Cause | Resolution |
|---|---|---|---|---|
| `E001` | `ListingNotFound` | Listing does not exist | Invalid `listing_id` | Verify listing identifier before call |
| `E002` | `ReservationConflict` | Reservation slot already booked | Double-submit | Refresh listing availability |
| `E003` | `InsufficientDeposit` | Deposit below required threshold | Underfunded reservation | Top up transaction amount |
| `E004` | `UnauthorizedAccess` | Caller lacks required role | Wrong signer or role | Use landlord/tenant/admin address |
| `E005` | `ContractPaused` | System is paused | Emergency pause active | Wait for admin unpause |
| `E006` | `FeeMismatch` | Split allocation invalid | Bad fee config | Correct platform and manager fees |
| `E007` | `DisputeNotOpen` | Dispute cannot be resolved | No active dispute | Confirm reservation state |

### Contract Events

| Event | Trigger | Description |
|---|---|---|
| `ListingCreated` | `mint_property()` | New property listing minted and registered |
| `ListingPublished` | `publish_listing()` | Listing becomes available for reservation |
| `ReservationCreated` | `reserve_listing()` | Tenant escrow deposit locked on-chain |
| `ReservationCheckedIn` | `confirm_checkin()` | Tenant confirmed arrival at property |
| `ReservationSettled` | `checkout_and_settle()` | Funds released and split on-chain |
| `DisputeOpened` | `raise_dispute()` | Tenant raised a dispute for reservation |
| `DisputeResolved` | `resolve_dispute()` | Admin resolved dispute and updated settlement |

## License

Licensed under the MIT License.

## Support

For platform support, contract deployment guidance, or architecture questions, open an issue in this repository.

## Contributing

Contributions are welcome through issues and pull requests. Please follow the existing coding standard, run linting before committing, and ensure all Prisma migrations and contract interfaces are aligned with the backend API.
