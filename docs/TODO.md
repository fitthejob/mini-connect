# Mini-Connect TODO

Tracks implementation status across the full architecture. Updated to reflect current deployed state.

**Status key:**
- `[x]` — complete and deployed
- `[ ]` — not yet implemented
- `[~]` — partial / in progress

---

## Core IVR Architecture

- [x] Connect instance via CDK (`lib/connect-instance-stack.ts`)
- [x] Hours-of-operation logic — Eastern Time M–F 9–5, federal holiday observance (`src/lambdas/hrs_of_ops.py`)
- [x] Bilingual language selection — English (Joanna Neural) / Spanish (Lupe Neural) via Lex at call entry
- [x] ANI-based caller identification — `GetCustomerProfile` block looks up caller by phone number before they speak
- [x] Customer Profiles domain — KMS-encrypted, DLQ with SQS resource policy (`lib/customer-profiles-stack.ts`)
- [x] Lex bot — bilingual (en_US / es_US), 7 domain intents with bilingual utterances and slots (`lib/lex-stack.ts`, `src/bots/`)
- [x] Main inbound flow — 5-section pure orchestration spine: call setup → intent capture → module dispatch → post-module routing → queue setup
- [x] Bilingual closed message with language detection

---

## Self-Service Modules (CONTACT_FLOW_MODULE)

- [x] Claims status — ClaimsLookup Lambda, 3-outcome branch (APPROVED/DENIED/PENDING), bilingual, persist `external*` attributes
- [x] Billing inquiry — BillingLookup Lambda, 3-outcome branch (PAID/UNPAID/OVERDUE), OVERDUE auto-transfer, bilingual
- [x] Prescription formulary — FormularyLookup Lambda, coverage + tier + copay + prior auth, bilingual
- [x] Provider network lookup — ProviderLookup Lambda, name or specialty+zip search, in-network status + phone, bilingual
- [x] Prior authorization — ProcedureLookup Lambda, coverage + auth requirement, prior-auth-required auto-transfer, bilingual
- [x] Eligibility check — reads coverageStatus from ANI lookup (no Lambda), 4-outcome branch, bilingual
- [x] Lambda results persisted as `external*` contact attributes before queue transfer

---

## Queue Routing and Hold Experience

- [x] Per-intent queue routing — `RouteToQueue` Compare block fans out to 5 domain queues on `callReason`
- [x] 5 domain queues — Claims, Billing, Pharmacy, Provider, MemberServices (`lib/connect-queues-stack.ts`)
- [x] 5 domain CUSTOMER_QUEUE hold flows — bilingual intent-specific hold messages (`src/flows/queue-experiences/`)
- [x] QueueAtCapacity — bilingual message before disconnect (no silent drop)
- [x] OfferTransfer timeout/no-match — routes to queue instead of silent disconnect (all 6 modules)
- [ ] **Callback on queue capacity** — offer queued callback when all agents are busy instead of message + disconnect
- [ ] **Sentiment-based routing** — Contact Lens check block; route to priority queue on negative sentiment
- [ ] **Estimated wait time** — `GetMetricData` block before queue transfer; offer callback if wait exceeds threshold

---

## Agent Experience

- [x] Agent screen pop at answer time — AWS-managed Detail view via `ShowView`, 7 intents
- [x] Caller name in AttributeBar — identified callers show first + last name; unidentified show "Unidentified Member"
- [x] Caller identity strip — Member ID, Plan, Coverage, Language always visible
- [x] Intent-specific Sections — Caller Intent (slot values) + Lookup Result (`external*` attributes) per intent
- [ ] **Routing profiles** — `CfnRoutingProfile` per domain queue; currently all agents on default
- [ ] **Security profiles** — `CfnSecurityProfile` with scoped permissions; currently all agents on default
- [ ] **Quick connects** — `CfnQuickConnect` for supervisor and specialist transfer targets
- [ ] **Contact Lens PII redaction** — `CfnRule` to redact member IDs and sensitive data from recordings/transcripts
- [ ] **Q in Connect agent assist** — knowledge base wired to Connect instance; surfaces relevant articles during live calls
- [ ] **Bedrock post-call summarization** — EventBridge on disconnect → Lambda → Bedrock Claude API → S3; surface in after-contact work

---

## Security and Identity

- [x] ANI-based identification — phone number as identity assertion; `callerIdentified` attribute set on profile found
- [x] Composite DynamoDB keys — claims `(claimId, memberId)`, billing `(invoiceId, memberId)`; callers cannot access other members' records
- [x] Plan-scoped formulary lookup — `planId` from ANI lookup; callers never state their plan
- [x] KMS encryption — Lambda artifacts, member data, Customer Profiles DLQ, SNS alarms (4 CMKs)
- [x] S3 versioning, access logging, autoDeleteObjects on artifact bucket
- [x] Lambda log groups — KMS-encrypted with retention policies
- [ ] **Second-factor identity verification** — ANI identifies but does not authenticate; a stolen phone can impersonate a member and receive PHI. A PIN or date-of-birth DTMF challenge after `LookupByPhone` is required before any PHI is read back in a production deployment. Sits between `LookupByPhone` and `Greeting` in the main inbound flow.
- [ ] **Multi-account deployment** — uncomment `accountMap` in `bin/mini-connect.ts`; separate dev/prod AWS accounts

---

## Data Layer

- [x] Member identity table — DynamoDB, KMS-encrypted (`lib/dynamodb-stack.ts`)
- [x] 5 backend domain tables — claims, providers, formulary, billing, procedure codes (`lib/backend/backend-data-stack.ts`)
- [x] 5 domain Lambda stacks — one per table (`lib/backend/claims-stack.ts` etc.)
- [x] Lambda deployment via S3/SSM staging pattern — explicit gate between artifact staging and deploy
- [x] Seed scripts — `seed-customer-profiles.ts`, `seed-backend-data.ts` (gitignored)
- [ ] **Customer Profiles data ingestion** — populate domain from DynamoDB member records automatically; options: S3 batch import via AppFlow, or Lambda on DynamoDB stream writing to Customer Profiles
- [ ] **Null-check for missing Lex slots** — `Compare` before each module's Lambda; targeted bilingual message when required slot wasn't captured (currently returns `found=false`, indistinguishable from genuine not-found)

---

## Omnichannel

The current implementation is voice-only. Amazon Connect supports chat, SMS, email, and tasks through the same routing infrastructure. Extending to additional channels requires channel-specific flows and routing profile configuration.

- [ ] **Chat channel** — author a `CONTACT_FLOW` for chat; add routing profile entry for chat queue; test via Connect test chat interface. Note: `MessageParticipantIteratively` (used in queue hold flows) is voice-only — chat hold requires a different block pattern
- [ ] **SMS** — configure an SMS channel via Amazon Pinpoint integration; author an SMS contact flow; SMS suits appointment reminders and outbound notifications more than inbound self-service
- [ ] **Task channel** — author a task contact flow; wire a Lambda to create tasks programmatically for async follow-up (e.g., post-call documentation, callback scheduling)
- [ ] **Channel branching in shared flows** — use `CheckContactAttributes` on `$.Channel` to branch voice vs chat paths within a single flow where the experience differs (e.g., DTMF input is voice-only; chat can use free-text)
- [ ] **Outbound campaigns** — `StartOutboundChatContact` or outbound voice via Connect Campaigns for proactive member outreach (e.g., prior auth status updates, appointment reminders)
- [ ] **Unified transcript handling** — Contact Lens transcripts across channels feed a common S3 prefix; Bedrock summarization Lambda handles voice transcripts today; extend to chat transcripts

---

## Observability

- [x] CloudWatch dashboard — Connect metrics (MiniConnect-MonitoringOps)
- [x] CloudWatch dashboard — Lambda + DynamoDB metrics (MiniConnect-MonitoringDev)
- [x] SNS alarms — KMS-encrypted alarm topics
- [x] Connect flow logging — log group with KMS encryption and retention
- [ ] **Per-queue CloudWatch alarms** — queue depth, handle time, and abandonment per intent; currently all Connect metrics are aggregated
- [ ] **CloudWatch log-based debugging** — document Lambda invocation log correlation via contact ID
- [ ] **Contact Lens analytics** — enable Contact Lens on the Connect instance; surface sentiment trends and common issues in dashboards

---

## Flow Infrastructure

- [x] `connect-flow-builder` — vendored local package with typed action builders, BFS layout engine, flow validation, catalog rendering (147 tests)
- [x] Pre-deploy validation — `validate-flows.ts` pushes all 13 flows to Connect sandbox flows; catches API contract errors before deploy
- [x] Two-layer rendering — same catalog renders with placeholder bindings (review) and real ARNs (deploy)
- [x] Auto-layout — BFS algorithm assigns canvas positions; height multipliers for tall block types
- [x] Validation sandbox flows — `ValidationSandboxInbound`, `ValidationSandboxQueue`, `ValidationSandboxModule` managed as IaC
- [ ] **Unit tests** — `src/bots/render.ts` and `src/flows/catalog.ts` using Node.js built-in test runner, following `connect-flow-builder` test suite pattern
- [ ] **DTMF fallbacks for Lex slots** — claim numbers and invoice numbers are hard to say accurately; add DTMF input path as alternative to speech
- [ ] **Medication name synonyms** — Lex slot synonym expansion for common medication name variants

---

## CI/CD and Operations

- [x] GitHub Actions pipeline — Checkov security scan, automatic dev deploy, manual prod approval gate (`.github/workflows/deploy.yml`)
- [x] Teardown script — env guard, interactive confirmation, S3 emptying, step-by-step verification (`scripts/teardown.ts`, gitignored)
- [x] Ops runbook — deploy procedure, rollback, alarm responses, Lambda debugging, Customer Profiles setup (`docs/RUNBOOK.md`)
- [x] Multi-environment CDK — `cdk.json` default env, context-based switching, `deploy:all:dev` / `deploy:all:prod` scripts
- [ ] **Hotswap deploy script** — `--hotswap` flag for flow content changes; document as the standard iteration path during flow development
- [ ] **Lambda reference doc** — update `docs/lambda-reference.md` to reflect all 7 current Lambdas and their invocation patterns

---

## IVR Experience Improvements

- [ ] **Second-factor verification** — see Security section above
- [ ] **Personalized greeting** — use `$.Customer.FirstName` from ANI lookup: "Welcome back, James" vs generic greeting
- [ ] **No-recognition re-prompt** — language prompt currently defaults to English on timeout/no-match; a re-prompt loop would improve first impressions
- [ ] **Confirmation before lookup** — confirm what the IVR understood before invoking Lambda (e.g., "Looking up claim CLM-2024-0047 — is that correct?")
- [ ] **Benefits self-service** — requires a benefits data model and DynamoDB table; currently routes directly to queue
