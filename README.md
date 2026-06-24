# mini-connect
*Built by [Andrew Conlon](https://github.com/fitthejob) — MIT License*

A reference CDK implementation of a bilingual Amazon Connect contact center for a health plan use case. Demonstrates a mature IVR architecture including ANI-based member identification, DTMF second-factor identity verification, Lex-driven intent routing, domain-specific Lambda integrations, Customer Profiles, per-intent queue routing with skill-based hold messaging, and an agent screen pop at answer time.

Built around [`connect-flow-builder`](https://github.com/fitthejob/connect-flow-builder) — a vendored TypeScript package that provides a type-safe DSL for authoring Amazon Connect contact flows as code.

---

## What It Does

A caller dials in. Before they say a word, their phone number is matched against a Customer Profiles domain to identify them as a health plan member. Their name, member ID, plan, and coverage status are available for the rest of the call. They are greeted by name, verify their identity with a DTMF date-of-birth challenge, select a language (English or Spanish), and state their intent.

Seven intents are handled:

| Intent | Self-service | Outcome |
|--------|-------------|---------|
| Claims status | ✅ ClaimsLookup Lambda | Reads back status, paid/billed amount, denial reason |
| Billing inquiry | ✅ BillingLookup Lambda | Reads back invoice status, amount, due date |
| Prescription formulary | ✅ FormularyLookup Lambda | Reads back tier, copay, prior auth requirement |
| Provider network | ✅ ProviderLookup Lambda | Confirms in-network status and phone number |
| Prior authorization | ✅ ProcedureLookup Lambda | Reads back coverage and auth requirement |
| Eligibility check | ✅ ANI lookup (no Lambda) | Reads back coverage status from profile |
| Benefits inquiry | Queue transfer | Routes to benefits specialist |

Every self-service path is handled by a domain `CONTACT_FLOW_MODULE`. The main inbound flow is a pure orchestration spine — it dispatches to modules and owns no domain logic.

When a call transfers to an agent, a screen pop fires at answer time using the AWS-managed Detail view. The agent sees the caller's name (or "Unidentified Member" for unrecognized callers), member ID, plan, coverage status, preferred language, the complete self-service result, and whether the IVR attempted a lookup — without re-asking the caller a single question.

---

## Architecture

### Stack topology (18 stacks)

```
MiniConnect-Kms
  ├── MiniConnect-Instance
  │     └── MiniConnect-Queues (6 domain queues + hours-of-operation)
  ├── MiniConnect-DynamoDB (member identity table)
  ├── MiniConnect-S3 (Lambda artifact bucket)
  │     └── MiniConnect-Lambda (hrs_of_ops, member_lookup, identity_verify)
  ├── MiniConnect-BackendData (5 DynamoDB tables)
  │     ├── MiniConnect-Claims
  │     ├── MiniConnect-Providers
  │     ├── MiniConnect-Formulary
  │     ├── MiniConnect-Billing
  │     └── MiniConnect-ProcedureCodes
  ├── MiniConnect-CustomerProfiles
  ├── MiniConnect-Lex (bilingual bot, en_US + es_US)
  ├── MiniConnect-SecurityProfiles (InstanceViewer read-only profile)
  └── MiniConnect-MonitoringOps / MonitoringDev
                                        ↓
                          MiniConnect-ContactFlows
```

### Flow catalog (13 flows)

**CONTACT_FLOW:**
- `MainInbound` — 5-section orchestration spine: call setup → second-factor verification → intent capture → module dispatch → post-module routing → queue setup

**CUSTOMER_QUEUE (6 hold experiences, one per domain queue):**
- `ClaimsQueueExperience`, `BillingQueueExperience`, `PharmacyQueueExperience`, `ProviderQueueExperience`, `MemberServicesQueueExperience`, `SupportQueueExperience`

**CONTACT_FLOW_MODULE (6 domain modules):**
- `ClaimsModule`, `BillingModule`, `FormularyModule`, `ProviderModule`, `PriorAuthModule`, `EligibilityModule`

### Per-intent queue routing

Every intent routes to its own domain queue with an intent-specific bilingual hold message. Agents receive calls from the correct specialist queue without additional triage.

| callReason | Queue | Hold message |
|---|---|---|
| `claims_status` | Claims | "We are happy to assist you with your claim..." |
| `billing` | Billing | "We are happy to assist you with your billing question..." |
| `prescription`, `prior_authorization` | Pharmacy | "We are happy to assist you with your prescription..." |
| `provider_lookup` | Provider | "We are happy to assist you with your provider search..." |
| `eligibility`, `benefits_inquiry`, fallback | MemberServices | "We are happy to assist you..." |

### Identity and security model

Callers are identified by ANI — their phone number is matched against the Customer Profiles domain before they speak. Identified callers are then challenged with a DTMF date-of-birth verification (MMDDYYYY, 2 attempts) before any PHI is accessed. The `identity_verify` Lambda compares the input against the member DynamoDB record directly; the DOB value never appears in a contact attribute or flow log.

Claims and billing use composite DynamoDB keys `(claimId, memberId)` and `(invoiceId, memberId)`. A caller cannot retrieve another member's record even if they know the ID. Formulary lookups are always scoped to the caller's plan — callers never need to state their plan.

### Lambda deployment pattern

All Lambdas use an S3/SSM staging pattern rather than `fromAsset`. Python source is zipped, uploaded to S3, and the version ID written to SSM. CDK reads the version ID at synth time and deploys the specific object version. This creates an explicit gate between artifact staging and infrastructure deployment.

### Two-layer flow rendering

Flows are rendered twice from the same catalog:

1. **Staging** — placeholder bindings for human review (`.staging/contact-flows/dev/`)
2. **Deployment** — real ARNs from deployed stacks, via `CfnContactFlow` resources

### Pre-deploy validation

`npm run validate:flows` renders all 13 flows with real ARNs from CloudFormation and pushes each to a dedicated sandbox flow on the Connect instance. Connect validates the full API contract — block type support per flow type, required parameters, error transition requirements — and returns specific error messages in seconds rather than discovering failures through CloudTrail after a deploy.

---

## Key Commands

```bash
# Build
npm run build

# Validate all flows against Connect sandbox (run before every deploy)
npm run validate:flows

# Stage flow artifacts for human review
npm run stage:flows

# Deploy individual stacks
npm run deploy:queues
npm run deploy:flows
npm run deploy:lambdas
npm run deploy:security-profiles

# Deploy everything
npm run deploy:all:dev

# Seed data
npm run seed:profiles -- dev
npm run seed:backend -- dev
```

---

## First-Time Setup

```bash
# 1. Bootstrap CDK
cdk bootstrap

# 2. Create SSM placeholder parameters
npm run bootstrap:ssm -- dev

# 3. Deploy KMS and S3 first
npm run deploy:kms
npm run deploy:s3

# 4. Stage and deploy all Lambda artifacts
npm run stage:lambdas -- dev all
npm run deploy:all:dev

# 5. Associate Customer Profiles domain with Connect instance
#    (manual console step — AWS does not expose this via API)
#    See docs/RUNBOOK.md → Customer Profiles → One-time console setup

# 6. Seed data
npm run seed:profiles -- dev
npm run seed:backend -- dev
```

---

## Repo Structure

```
bin/
  mini-connect.ts              CDK app entry — wires all 18 stacks

lib/
  connect-instance-stack.ts
  connect-queues-stack.ts      6 domain queues + hours-of-operation
  contact-flows-stack.ts       Renders and deploys all 13 flows
  lambda-stack.ts              hrs_of_ops, member_lookup, identity_verify
  lex-stack.ts
  kms-stack.ts / s3-stack.ts / dynamodb-stack.ts
  customer-profiles-stack.ts
  security-profiles-stack.ts   InstanceViewer read-only security profile
  backend/                     5 domain Lambda stacks
  observability/               CloudWatch dashboards + SNS alarms

src/flows/
  catalog.ts                   Registers all 13 flow specs
  main-inbound.ts              Primary inbound CONTACT_FLOW (5 sections)
  support-queue-experience.ts  Generic fallback CUSTOMER_QUEUE
  queue-experiences/           5 domain CUSTOMER_QUEUE hold flows
  modules/                     6 domain CONTACT_FLOW_MODULE specs

src/lambdas/                   Python Lambda handlers (8 functions)
src/bots/                      Lex bot definition (bilingual, 7 intents)

scripts/
  stage-contact-flows.ts       Renders flows with placeholder bindings
  validate-flows.ts            Validates all flows against Connect sandboxes
  stage-lambdas.ts             Zips, uploads, stages Lambda artifacts
  bootstrap-ssm.ts             Creates SSM placeholder parameters

docs/
  FLOW-BIBLE.md                Block-by-block caller experience documentation
  CX-STATE.md                  Caller experience gaps and planned improvements
  AX-STATE.md                  Agent experience documentation and gaps
  RUNBOOK.md                   Deploy, teardown, rollback, debugging

connect-flow-builder/          Vendored local package (modified for bug fixes)
```

---

## connect-flow-builder

`connect-flow-builder` is vendored as a local package dependency:

```json
"connect-flow-builder": "file:./connect-flow-builder"
```

This repo has modified the package to fix Connect API contract issues discovered through live deployment — auto-injection of required error branches, DTMF input constraints, Customer Profile response field format, `CONTACT_FLOW_MODULE` support, and a layered BFS layout algorithm that assigns canvas positions to every block. The package has 147 tests covering all action builders, validators, and catalog rendering.

The separation of concerns is intentional:
- `connect-flow-builder` owns flow authoring, validation, layout, and staged rendering
- `mini-connect` owns AWS resource wiring, CDK stacks, Lambda code, and deployment

---

## Planned

- **Bedrock post-call summarization** — EventBridge on disconnect → Lambda → Bedrock Claude API → write summary to S3
- **Unit tests** — `src/bots/render.ts` and `src/flows/catalog.ts` using Node.js built-in test runner
- **Routing profiles** — `CfnRoutingProfile` per domain queue for skill-based routing
- **Callback on queue capacity** — queued callback offer when all agents are busy
