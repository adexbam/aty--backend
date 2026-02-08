# ATY Core Domain Boundaries & Source-of-Truth Decisions
Perspective: Senior Software Engineer / Domain-Driven Design Architect (first-6-month scalability, zero-rebuild mandate)

## 1. Purpose of This Document
This document formally defines and freezes the core domain boundaries and source-of-truth decisions for the AgriTech Yield (ATY) platform.

Goals:
- Prevent architectural drift.
- Avoid costly rebuilds after scale.
- Ensure regulatory, operational, and data correctness.
- Provide a single reference for engineering, product, and compliance.
- Once approved, changes should be rare, deliberate, and versioned.

## 2. Guiding Principles (Non-Negotiable)
- Single source of truth per domain: each core domain has exactly one authoritative data owner.
- Core truth != high volume: high-volume data must never compromise correctness of core truth.
- No circular ownership: domains may reference each other, but only one owns the truth.
- Auditability by construction: every core state change must be traceable and immutable.
- AWS-first, cloud-agnostic core: infrastructure may change; domain logic must not.

## 3. Frozen Core Domain Boundaries
These domains are considered system-of-record and must be implemented with strict relational integrity from day 1.

### 3.1 Identity & Access Domain
| Field | Details |
| --- | --- |
| Responsibility | User identity; roles and permissions; KYC status; wallet linkage |
| Owns Truth For | Who a user is; what actions they are allowed to perform; whether they are compliant to transact |
| Source of Truth | PostgreSQL |
| Notes | No other domain may redefine user roles or KYC state; wallet ownership is enforced here |

### 3.2 Land Management Domain
| Field | Details |
| --- | --- |
| Responsibility | Landowner onboarding; land plot registration; plot metadata (size, location, soil); availability windows |
| Owns Truth For | Which land exists in the system; who owns which land; whether land is eligible for allocation |
| Source of Truth | PostgreSQL |
| Notes | No service or order can create land implicitly; land verification is immutable once approved |

### 3.3 Land Allocation Domain
| Field | Details |
| --- | --- |
| Responsibility | Reserving land for service orders; preventing double-booking; managing allocation lifecycle |
| Owns Truth For | Which service order controls which plot at any time |
| Source of Truth | PostgreSQL (strong constraints + transactions) |
| Hard Invariants | A land plot may have only one ACTIVE allocation at a time; allocation history is append-only |

### 3.4 Service Lifecycle Domain
| Field | Details |
| --- | --- |
| Responsibility | Service package selection; service order creation; order state machine |
| Owns Truth For | Status of a renter's service; whether a service is pending, active, farming, harvested, or delivered |
| Source of Truth | PostgreSQL |
| Notes | State transitions are explicit and audited; no external system may mutate order state directly |

### 3.5 Token Redemption Ledger (Off-Chain Mirror)
| Field | Details |
| --- | --- |
| Responsibility | Verifying on-chain token redemptions; mapping redemptions 1:1 to service orders |
| Owns Truth For | Whether a service has been validly paid for |
| Source of Truth | PostgreSQL (mirroring blockchain state) |
| Notes | Blockchain is authoritative for transactions; backend is authoritative for service activation; ATY never custody tokens or funds |

### 3.6 Farm Operations Domain
| Field | Details |
| --- | --- |
| Responsibility | Crop cycles; farm tasks; input usage; media verification |
| Owns Truth For | What work was performed on a plot; what crop was grown and harvested |
| Source of Truth | PostgreSQL (media stored externally) |
| Notes | Media files stored in object storage (URLs only in DB); ops data cannot alter service eligibility |

### 3.7 Logistics & Delivery Domain
| Field | Details |
| --- | --- |
| Responsibility | Delivery orders; delivery tracking; handoff verification |
| Owns Truth For | Whether crops were delivered and confirmed |
| Source of Truth | PostgreSQL + async event processing |
| Notes | External providers feed events, but do not own delivery truth |

### 3.8 Marketplace & Buyer Domain
| Field | Details |
| --- | --- |
| Responsibility | Listings; buyer offers; transactions |
| Owns Truth For | Market intent and settlement status |
| Source of Truth | PostgreSQL |
| Notes | ATY does not custody buyer or seller funds; settlement references are recorded, not executed |

## 4. Explicitly Non-Core / Non-Authoritative Domains
These domains must never become system-of-record for business truth.

| Domain | Constraints |
| --- | --- |
| Audit & Domain Events | Append-only; derived from core actions; used for compliance and transparency |
| Media & Documents | Photos, videos, contracts; stored in object storage; DB stores metadata only |
| IoT & Sensor Data (Phase 2) | Time-series data; advisory only; must not gate service lifecycle |
| Analytics & Reporting | Read replicas / derived tables; never write back to core domains |

## 5. Source-of-Truth Summary Table
| Domain | Source of Truth | Mutable? | Can Be Rebuilt Later? |
| --- | --- | --- | --- |
| Identity & Access | PostgreSQL | Yes (controlled) | No |
| Land Management | PostgreSQL | Limited | No |
| Land Allocation | PostgreSQL | Strict | No |
| Service Lifecycle | PostgreSQL | Yes (state machine) | No |
| Token Ledger | PostgreSQL (mirror) | Append-only | No |
| Farm Operations | PostgreSQL | Yes | Limited |
| Logistics | PostgreSQL + Events | Yes | Limited |
| Marketplace | PostgreSQL | Yes | Yes |
| Media | Object Storage | Yes | Yes |
| IoT | Time-series | Yes | Yes |
| Analytics | Derived | Yes | Yes |

## 6. Formal Schema Mapping (Postgres Schema v1)
This section maps each core domain to its authoritative Postgres tables and key integrity rules.

| Domain | Tables | Key Constraints |
| --- | --- | --- |
| Identity & Access | user; role; user_role; kyc_profile; wallet | User status check (ACTIVE, SUSPENDED, DELETED); KYC status check (PENDING, VERIFIED, REJECTED); unique email/phone (partial unique indexes); unique wallet per chain/address (normalized) |
| Land Management | land_plot; land_plot_document; land_plot_availability | Plot size > 0; status check (AVAILABLE, ALLOCATED, INACTIVE); availability windows must not overlap per plot (EXCLUDE USING gist); availability date range validity (start_date < end_date) |
| Service Lifecycle | service_package; service_order; order_state_transition (partitioned) | Order status check (PENDING, ACTIVE, FARMING, HARVESTED, DELIVERED, CANCELLED, EXPIRED); idempotency key unique per renter; state transitions append-only via partitioned history table |
| Token Redemption Ledger | token_redemption | Unique tx_hash; 1:1 service_order_id mapping (unique); status check (PENDING, VERIFIED, FAILED) |
| Land Allocation | land_allocation | One ACTIVE allocation per plot (partial unique index); no overlapping ACTIVE allocations (EXCLUDE USING gist); allocation date range validity (start_date < end_date) |
| Farm Operations | crop_cycle; farm_task; verification_media | Expected/actual yield non-negative; task types and statuses enforced; media types enforced (PHOTO, VIDEO) |
| Logistics & Delivery | delivery_order; delivery_event; delivery_proof | Delivery status check (CREATED, IN_TRANSIT, DELIVERED, FAILED, CANCELLED); delivery event status check; proof types enforced (PHOTO, SIGNATURE, QR, OTP) |
| Marketplace & Buyer | harvest_batch; quality_assessment; market_listing; buy_offer; market_transaction | Quantity and price checks; listing status check (OPEN, RESERVED, SOLD, CANCELLED); one listing per harvest batch (unique); one active offer per buyer per listing (partial unique); buyer and seller must differ in transactions |
| Domain Events (Non-Core) | domain_event (partitioned) | Append-only log with optional performed_by reference |

## 7. Event & Queue Architecture Summary (aty-arch.md)
This section captures the eventing backbone that enforces domain boundaries without cross-service DB transactions.

### 7.1 Core Guarantees and Non-Goals
| Category | Items |
| --- | --- |
| Guarantees | At-least-once delivery; immutable audit trail; single-writer per domain |
| Avoids | Exactly-once semantics; cross-service joins; queue-as-database |

### 7.2 Architecture Backbone
| Component | Purpose |
| --- | --- |
| Outbox table (per domain DB) | Atomic DB write + event record |
| Outbox publisher worker | Publishes outbox events and marks published |
| Message bus | SNS/SQS (AWS) or Kafka/NATS (portable) |
| Per-consumer queues | Isolation per module/service |
| Retries + DLQ | Failure handling and isolation |
| Consumer idempotency store | Deduplication for at-least-once delivery |

### 7.3 Frozen Event Contracts (Minimal Cross-Domain Dependencies)
| Event | Producer | Consumers | Purpose |
| --- | --- | --- | --- |
| orders.serviceOrderCreated.v1 | Orders | Token, Audit | Start saga, record |
| token.tokenRedemptionVerified.v1 | Token | Allocation, Audit | Gate activation |
| token.tokenRedemptionFailed.v1 | Token | Orders, Audit | Cancel or keep pending |
| allocation.plotAllocated.v1 | Allocation | Orders, FarmOps, Audit | Assign plot, start ops |
| allocation.plotAllocationFailed.v1 | Allocation | Orders, Audit | Keep pending, retry policy |
| orders.serviceOrderActivated.v1 | Orders | FarmOps, Audit | Start farming workflow |
| ops.harvestRecorded.v1 | FarmOps | Harvest, Audit | Create batch |
| harvest.harvestAvailableForListing.v1 | Harvest | Marketplace, Audit | Enable listing |
| harvest.harvestReadyForDelivery.v1 | Harvest | Logistics, Audit | Create delivery order |
| logistics.deliveryCompleted.v1 | Logistics | Orders, Audit | Close order delivered |
| market.transactionSettled.v1 | Marketplace | Orders, Audit | Close out sold path |

### 7.4 Outbox Pattern (Reliability Mandate)
| Rule | Description |
| --- | --- |
| Atomicity | Core DB write and outbox_event insert in same transaction |
| Publish | Publisher sends to bus, then sets published_at |

### 7.5 Consumer Idempotency (Non-Negotiable)
| Rule | Description |
| --- | --- |
| Dedup | consumer_dedup prevents re-processing of event_id per consumer |

### 7.6 Queue Policy
| Policy | Value |
| --- | --- |
| Retries | 5 attempts |
| Backoff | Exponential: 10s, 30s, 2m, 10m, 30m |
| DLQ | After retries exhausted; alert when DLQ > 0 |

### 7.7 Ordering Rules
| Scope | Rule |
| --- | --- |
| Aggregate | Order by service_order_id (or aggregate id) |
| Global | Not required; use sequence numbers or ignore stale state |

### 7.8 Activation Saga (Token-Gated)
| Step | Flow |
| --- | --- |
| Success | ServiceOrderCreated -> TokenRedemptionVerified -> PlotAllocated -> ServiceOrderActivated |
| Failure | PlotAllocationFailed -> Order stays PENDING (or FAILS per policy) |

### 7.9 AWS-First, Portable
| Layer | Mapping |
| --- | --- |
| Interfaces | EventBus.publish; Queue.consume; OutboxPublisher |
| AWS | SNS/SQS + ECS/EKS |
| Portable options | Kafka; NATS JetStream; BullMQ (local dev) |

## 8. PRD-Derived Product Context (Gaps Filled)
This section captures product-level requirements that are missing from the domain/source-of-truth document.

### 8.1 Product Overview
ATY is a blockchain-enabled agricultural services platform where users rent virtual farm plots, redeem ATY utility tokens for managed farming, receive physical crop output, or sell harvests to verified buyers. Tokens function as prepaid service credits only (no yield/staking).

### 8.2 Objectives and Success Metrics
| Objective | Metric |
| --- | --- |
| Growth | 1,000 active renters within 6 months of MVP launch |
| Service reliability | 85%+ service redemption completion rate |
| Delivery reliability | 95% delivery success rate |
| Supply growth | 10,000 acres onboarded by end of Year 2 |
| Operational accuracy | <2% ops error rate (allocation/delivery mismatch/double-booking) |
| Token utilization | 10–15% redemption-to-service ratio (seasonal average) |

### 8.3 Scope (Phase 1)
| In Scope | Out of Scope |
| --- | --- |
| User onboarding (renter/landowner/buyer); token redemption; land allocation; farming ops; crop delivery; buyer marketplace; blockchain ledger for service tokens; mobile + web interfaces; multi-party communication | User-generated farming strategies; DAO governance; staking/yield mechanics; multi-country expansion; retail consumer delivery |

### 8.4 Personas
| Persona | Needs | Pain Points |
| --- | --- | --- |
| Renters | Easy farming, passive crop output, verified buyers | No land/time, fear of scams |
| Landowners | Monetize idle land, reliable renters | No structured rental marketplace |
| Buyers | Bulk supply, consistent quality | Supply instability, inconsistent delivery |
| ATY Ops Team | Tracking, communication, verification tools | Operational coordination complexity |

### 8.5 Feature Requirements (Product Level)
| Feature | Key Requirements | Success Criteria |
| --- | --- | --- |
| Token integration | Wallet creation, balance/history, smart-contract redemption, off-chain ledger; no staking/yield | Redemption <5s; zero service-token mismatch; full audit trail |
| Service packages | UI selection; smart-contract verify; backend allocation; activation confirmation | Activation after verified redemption |
| Land allocation engine | Metadata DB; allocation rules; conflict prevention; landowner availability | <1% conflicts; 100% traceability |
| Farm management | Task scheduling; status tracking; input usage; media verification; weather alerts | Operational traceability |
| Logistics | Delivery order; tracking; routing; QR/OTP verification; claims workflow | 95% on-time; confirm within 30 mins |
| Buyer marketplace | Buyer KYC; price discovery; direct settlement; grading | Verified buyer liquidity |
| Landowner matching | Onboarding; verification; matching algorithm; earnings dashboard | Stable land supply |
| Reporting dashboard | Growth timeline; on-chain logs; IoT readings (Phase 2); transparency reports | Trust and compliance visibility |

### 8.6 Token Economics (Product Constraints)
| Area | Requirement |
| --- | --- |
| Supply | 1,000,000,000 ATY; no inflation in Phase 1 |
| Usage ratio | 90% circulating liquidity; 10% seasonal utility redemption |
| Lock/burn | Redeemed tokens may be temporarily locked; burn optional later |
| Pricing anchor | Pegged to ops/logistics/seasonality costs |
| Liquidity | ≥20% reserved for liquidity pools and market making |

### 8.7 Technical Requirements (Product Level)
| Layer | Requirement |
| --- | --- |
| Blockchain | ERC-20 or equivalent; redemption smart contracts; oracle integration |
| Backend | Node.js; AWS-based services; allocation/ops/logistics/marketplace engines |
| Mobile | iOS + Android wallet, redemption, crop tracking, buyer offers |
| Security | KYC/AML; encryption; multisig admin controls; smart contract audits |

### 8.8 Non-Functional Requirements
| Category | Requirement |
| --- | --- |
| Performance | Redemption <5s; dashboard updates <= 1s; 50k concurrent users |
| Availability | 99.5% uptime; redundant clusters |
| Scalability | Multi-region land clusters; 1M+ token tx/year |
| Compliance | Utility-only token model; CBN/SEC Nigeria compliance |

### 8.9 Dependencies and Risks
| Dependencies | Risks and Mitigations |
| --- | --- |
| Farmland partnerships; logistics providers; smart contract auditor; IoT vendor; government programs | Crop failure → insurance + multi-region farms; token misuse → smart contract limits; regulatory pressure → utility-only model; delivery failures → SLA-based logistics; land disputes → verified contracts |

### 8.10 Launch Plan
| Phase | Timeline | Targets |
| --- | --- | --- |
| Phase 1 — MVP | Q1 2026 | 100 acres; 1,000 user plots; basic marketplace; logistics network |
| Phase 2 — Scale | Q2–Q4 2026 | IoT sensors; advanced marketplace; 2,500 landlords |
| Phase 3 — National | 2027 | Multi-region coverage; retail processors onboarded |

## 9. Enforcement
These decisions must be enforced through:
- Database constraints.
- Code ownership boundaries.
- Service/module separation.
- Architecture reviews.
- Any violation of these boundaries is considered a system design defect, not a feature shortcut.

## 10. Status
- Document Status: READY FOR SIGN-OFF.
- Applies To: MVP -> National Scale.
