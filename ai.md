# 🌍 Stellar Pad Real Estate Protocol: Core Architectural Blueprint (ai.md)

This document specifies the exact data contracts and event signatures across the stack.

## 1. Multi-Tier Data Architecture Flow
- Frontend requests fast data reads directly from the Stellar Pad Node.js Express REST API.
- Frontend broadcasts signed transaction XDR directly to the Stellar network.
- Stellar Pad Soroban contracts process state changes and emit real-time ledger events.
- Node.js Ingestion Worker parses events and syncs updates seamlessly back to PostgreSQL.

## 2. Soroban Smart Contract Reference (Rust Definitions)
```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransactionMode { ShortTerm, LongTerm, Sale }

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListingConfig {
    pub id: u128,
    pub host: Address,
    pub token_address: Address,
    pub mode: TransactionMode,
    pub rate_per_unit: i128,
    pub deposit_required: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReservationRecord {
    pub id: u128,
    pub listing_id: u128,
    pub guest: Address,
    pub check_in: u64,   // Unix timestamp
    pub check_out: u64,  // Unix timestamp
    pub total_amount: i128,
    pub escrow_id: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowRecord {
    pub id: u128,
    pub reservation_id: u128,
    pub depositor: Address,
    pub amount: i128,
    pub token: Address,
    pub status: EscrowStatus,  // Locked | Released | Refunded | Disputed
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaseRecord {
    pub id: u128,
    pub listing_id: u128,
    pub tenant: Address,
    pub host: Address,
    pub rate_per_second: i128,
    pub token: Address,
    pub started_at: u64,
}
```

## 3. Soroban Contract Events (Off-Chain Ingestion Targets)

All events are emitted via `env.events().publish(...)` and parsed by the Node.js ingestion worker.

| Event Topic         | Data Payload Fields                              | Triggers DB Action           |
|---------------------|--------------------------------------------------|------------------------------|
| `listing_created`   | `id, host, mode, rate_per_unit, deposit`         | INSERT Listing               |
| `listing_updated`   | `id, rate_per_unit, is_active`                   | UPDATE Listing               |
| `reservation_made`  | `id, listing_id, guest, check_in, check_out`     | INSERT Reservation           |
| `reservation_confirmed` | `id, tx_hash`                              | UPDATE Reservation status    |
| `escrow_locked`     | `id, reservation_id, depositor, amount`          | INSERT Escrow (LOCKED)       |
| `escrow_released`   | `id, tx_hash`                                    | UPDATE Escrow (RELEASED)     |
| `escrow_refunded`   | `id, tx_hash`                                    | UPDATE Escrow (REFUNDED)     |
| `lease_started`     | `id, listing_id, tenant, rate_per_second`        | INSERT Lease (ACTIVE)        |
| `lease_terminated`  | `id, total_streamed`                             | UPDATE Lease (TERMINATED)    |
| `review_posted`     | `listing_id, author, target, rating, tx_hash`    | INSERT Review                |

## 4. REST API Contract (Express Routes)

### Listings
```
GET    /api/listings                  → paginated list (filter: mode, city, minRate, maxRate)
GET    /api/listings/:id              → full listing detail + host profile
POST   /api/listings                  → create listing (off-chain metadata only; on-chain via Soroban)
PATCH  /api/listings/:id              → update metadata (host-only, auth required)
```

### Reservations
```
GET    /api/reservations/:id          → reservation detail
GET    /api/listings/:id/reservations → all reservations for a listing (host-only)
POST   /api/reservations              → create pending reservation record
PATCH  /api/reservations/:id/status   → update status (ingestion worker driven)
```

### Escrows
```
GET    /api/escrows/:id               → escrow detail
GET    /api/reservations/:id/escrow   → escrow for a reservation
```

### Leases
```
GET    /api/leases/:id                → lease detail + streaming progress
GET    /api/listings/:id/leases       → all leases for a listing
```

### Reviews
```
GET    /api/listings/:id/reviews      → paginated reviews for a listing
POST   /api/reviews                   → post a review (requires completed reservation)
```

### Users
```
GET    /api/users/:stellarAddress     → public user profile
POST   /api/users                     → upsert user on first wallet connect
```

## 5. PostgreSQL ↔ Soroban Data Type Mapping

| Soroban Type   | PostgreSQL / Prisma Type | Rationale                                    |
|----------------|--------------------------|----------------------------------------------|
| `u128` / `i128`| `String`                 | JS `BigInt` safe; no precision loss          |
| `Address`      | `String`                 | Stellar G... or C... address (56 chars)      |
| `u64` timestamp| `DateTime`               | Converted from Unix seconds at ingestion     |
| `bool`         | `Boolean`                | Direct mapping                               |
| `String`       | `String` / `Text`        | Direct mapping                               |

## 6. Ingestion Worker Architecture

```
[Stellar Horizon / RPC]
        │  poll ledger events every ~5s
        ▼
[Event Ingestion Worker]  (/src/workers/event-ingestion.worker.ts)
        │  parse → normalize → validate
        ▼
[Event Handlers]          (/src/workers/handlers/)
  ├── listing.handler.ts
  ├── reservation.handler.ts
  ├── escrow.handler.ts
  ├── lease.handler.ts
  └── review.handler.ts
        │  upsert via Prisma
        ▼
[PostgreSQL / Prisma]     (read model — serve to frontend at zero latency)
```

## 7. Authentication Strategy

- Wallets sign a challenge message with their Stellar private key.
- Backend verifies the signature against the public key (Stellar SDK `Keypair.verify`).
- Issues a short-lived JWT containing `{ sub: stellarAddress, role }`.
- No passwords. No OAuth. Purely cryptographic.

## 8. Environment Variables Reference

| Variable        | Description                             |
|-----------------|-----------------------------------------|
| `DATABASE_URL`  | PostgreSQL connection string            |
| `PORT`          | Express server port (default: 3000)     |
| `NODE_ENV`      | `development` \| `production`           |
| `STELLAR_NETWORK` | `testnet` \| `mainnet`               |
| `HORIZON_URL`   | Stellar Horizon RPC endpoint            |
| `JWT_SECRET`    | HS256 signing secret for auth tokens    |
| `JWT_EXPIRES_IN`| Token TTL (e.g., `1h`)                  |
