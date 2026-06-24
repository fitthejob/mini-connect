# AX State

Tracks the current agent experience at every point of contact handling — what agents see, hear, and can do when they receive a call routed through mini-connect. Documents known gaps and planned improvements from the agent's perspective.

The agent experience is a direct determinant of caller experience quality. An agent who arrives at a call without context, re-asks questions the IVR already answered, or navigates a cluttered workspace is slower, more error-prone, and less able to help.

**Status key:**
- `[live]` — deployed and working as described
- `[gap]` — known deficiency in the current implementation
- `[planned]` — improvement scoped and ready to implement
- `[future]` — acknowledged but not yet scoped

---

## Agent Workspace API Surface

Most of the agent workspace visual layout is not exposed via any API — panel order, tab visibility, and workspace layout are console-only in Connect today. What is programmable:

| Capability | API available | IaC via CDK | Status |
|---|---|---|---|
| Step-by-Step Guide views (`ShowView` + AWS-managed views) | Yes | Flow-only (no CDK resource for AWS-managed) | `[live]` |
| Custom views (`CfnView`) | Yes | Yes | Not used |
| Routing profiles | Yes | Yes | `[live]` |
| Security profiles | Yes | Yes | Not configured |
| Quick connects | Yes | Yes | Not configured |
| Agent statuses | Yes | Yes | Not configured |
| Contact Lens real-time alerts | Yes | Yes (`CfnRule`) | Not configured |
| Workspace panel layout | No | No | — |
| Q in Connect association | No | No | — |

---

## Screen Pop at Answer Time `[live]`

When an agent answers a call, the AWS-managed **Detail view** fires immediately via the `ShowView` block in `MainInbound`. The view is selected per intent — `RouteToQueue` branches on `callReason` to 7 `ShowXxxView` blocks before routing the call to the domain queue.

### How it works

`ShowView` is an `Integrate` block in the flow. It fires at call routing time (before the agent answers) so the card is visible the instant the agent accepts the contact. The AWS-managed Detail view is a global Connect resource — no CDK stack deployment required.

### What agents see

All 7 intents render the same structural layout with intent-specific content:

**AttributeBar (top strip — always visible)**

| Label | Source attribute |
|-------|-----------------|
| Member ID | `$.Attributes.memberId` |
| Plan | `$.Attributes.planId` |
| Coverage | `$.Attributes.coverageStatus` |
| Language | `$.Attributes.preferredLanguage` |

**Sections body**

Each view has two `DataSection` panels:

1. **Caller Intent** — what the caller said to the IVR (slot values and call reason)
2. **Lookup Result** — what the IVR found (Lambda `external*` attributes)

**Per-intent content:**

---

### Claims Status view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `claims_status` |
| Claim Number | `slotClaimNumber` |
| Date of Service | `slotDateOfService` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Status | `externalStatus` | APPROVED / DENIED / PENDING |
| Billed Amount | `externalBilledAmount` | Dollar amount billed |
| Paid Amount | `externalPaidAmount` | Dollar amount plan paid (APPROVED only) |
| Denial Reason | `externalDenialReason` | Populated on DENIED claims |
| Date of Service | `externalDateOfService` | From claim record |

**Agent context:** The caller has already heard their claim status. If DENIED, they are likely distressed and calling to appeal. If APPROVED or PENDING, they may have follow-up questions about amounts or timeline.

---

### Billing Inquiry view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `billing` |
| Invoice Number | `slotInvoiceNumber` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Status | `externalStatus` | PAID / UNPAID / OVERDUE |
| Amount | `externalAmount` | Invoice total |
| Date Issued | `externalDateIssued` | When invoice was created |
| Due Date | `externalDueDate` | Payment deadline |
| Description | `externalDescription` | Service description from invoice |

**Agent context:** OVERDUE callers were auto-transferred — they did not press a button. They may not know their balance is past due. UNPAID callers heard the amount and due date and chose to speak with someone. PAID callers may be disputing a charge or need a receipt.

---

### Prescription Formulary view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `prescription` |
| Medication Name | `slotMedicationName` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Medication | `externalMedicationName` | Normalized name from formulary |
| Covered | `externalCovered` | true / false |
| Tier | `externalTier` | Formulary tier (1–4) |
| Copay | `externalCopay` | Dollar copay amount |
| Requires Prior Auth | `externalRequiresPriorAuth` | true / false |

**Agent context:** If `externalRequiresPriorAuth=true`, the caller was auto-transferred to pharmacy. They need to start the prior authorization process. If `externalCovered=false`, caller heard "not covered" and wants alternatives.

---

### Provider Network Lookup view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `provider_lookup` |
| Provider Name | `slotProviderName` |
| Specialty | `slotSpecialty` |
| Zip Code | `slotZipCode` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Name | `externalName` | Provider name from database |
| Phone | `externalPhone` | Provider phone number |
| In-Network | `externalInNetwork` | true / false |

**Agent context:** If `externalInNetwork=false`, the caller heard "not in-network" and wants help finding an alternative. If `externalInNetwork=true`, the caller may want to schedule an appointment or get additional details (address, accepting new patients, etc.) the IVR couldn't provide over voice.

---

### Prior Authorization view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `prior_authorization` |
| Procedure Code | `slotProcedureCode` |
| Provider Name | `slotProviderName` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Covered | `externalCovered` | true / false |
| Requires Prior Auth | `externalRequiresPriorAuth` | true / false |
| Description | `externalDescription` | Procedure description |

**Agent context:** Prior auth callers are often pre-surgical and anxious. If `externalRequiresPriorAuth=true`, they were auto-transferred — they need immediate help starting the authorization process. The procedure code and description tell the agent exactly what's being requested without re-asking.

---

### Eligibility Check view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `eligibility` |

**Lookup Result section:**
| Label | Attribute | Notes |
|-------|-----------|-------|
| Coverage Status | `coverageStatus` | ACTIVE / SUSPENDED / PENDING |
| Member ID | `memberId` | From ANI lookup |
| Plan | `planId` | From ANI lookup |

**Agent context:** Eligibility is self-served inline with no Lambda — coverage status comes directly from the ANI lookup. SUSPENDED callers were auto-transferred. ACTIVE/PENDING callers who pressed 1 have follow-up questions. The agent already has all the information that was read to the caller.

---

### Benefits Inquiry view

**Caller Intent section:**
| Label | Attribute |
|-------|-----------|
| Call Reason | `callReason` → `benefits_inquiry` |
| Service Type | `slotServiceType` |

**Lookup Result section:** (empty — no Lambda for benefits)

**Agent context:** Benefits was not self-served — no backend data exists for benefits lookup. The IVR said "Let me connect you with a benefits specialist." The agent knows the service type the caller asked about and can look it up in their own systems.

---

## Contact Attribute Availability at Answer Time

All contact attributes set during the IVR are available in the agent workspace's contact attribute panel as a fallback even when not surfaced by the view.

### Attributes always present

| Attribute | Set by | Description |
|-----------|--------|-------------|
| `preferredLanguage` | MainInbound | `en` or `es` |
| `callReason` | SetIntentXxx blocks | Intent identifier |
| `needsTransfer` | Modules | `true` when agent needed |
| `memberId` | ANI lookup | Health plan member ID |
| `planId` | ANI lookup | Plan identifier |
| `coverageStatus` | ANI lookup | ACTIVE / SUSPENDED / PENDING |

### Attributes present when Lex captured a slot

| Attribute | Intent |
|-----------|--------|
| `slotClaimNumber` | Claims |
| `slotDateOfService` | Claims |
| `slotInvoiceNumber` | Billing |
| `slotMedicationName` | Formulary |
| `slotProviderName` | Provider, Prior Auth |
| `slotSpecialty` | Provider |
| `slotZipCode` | Provider |
| `slotProcedureCode` | Prior Auth |
| `slotServiceType` | Benefits |

### Attributes present when Lambda lookup succeeded

| Attribute | Module | Lambda field |
|-----------|--------|-------------|
| `externalStatus` | Claims, Billing | `$.External.status` |
| `externalDateOfService` | Claims | `$.External.dateOfService` |
| `externalBilledAmount` | Claims | `$.External.billedAmount` |
| `externalPaidAmount` | Claims | `$.External.paidAmount` |
| `externalDenialReason` | Claims | `$.External.denialReason` |
| `externalAmount` | Billing | `$.External.amount` |
| `externalDateIssued` | Billing | `$.External.dateIssued` |
| `externalDueDate` | Billing | `$.External.dueDate` |
| `externalDescription` | Billing, Prior Auth | `$.External.description` |
| `externalMedicationName` | Formulary | `$.External.medicationName` |
| `externalCovered` | Formulary, Prior Auth | `$.External.covered` |
| `externalTier` | Formulary | `$.External.tier` |
| `externalCopay` | Formulary | `$.External.copay` |
| `externalRequiresPriorAuth` | Formulary, Prior Auth | `$.External.requiresPriorAuth` |
| `externalName` | Provider | `$.External.name` |
| `externalPhone` | Provider | `$.External.phone` |
| `externalInNetwork` | Provider | `$.External.inNetwork` |

---

## Queue and Routing Context

Agents receive calls from domain-specific queues. The queue the call arrives from tells the agent the intent before they even look at the screen pop.

| Queue | Intents routed here |
|-------|---------------------|
| Claims | claims_status |
| Billing | billing |
| Pharmacy | prescription, prior_authorization |
| Provider | provider_lookup |
| MemberServices | eligibility, benefits_inquiry, timeout/no-match |

---

## Hold Experience (What Callers Hear While Waiting)

Each domain queue plays an intent-specific hold message. Agents don't hear this, but it sets caller expectations and affects the emotional state of the caller at answer time.

| Queue | English hold message |
|-------|---------------------|
| Claims | "We are happy to assist you with your claim. A claims specialist will be with you shortly." |
| Billing | "We are happy to assist you with your billing question. A billing specialist will be with you shortly." |
| Pharmacy | "We are happy to assist you with your prescription. A pharmacy specialist will be with you shortly." |
| Provider | "We are happy to assist you with your provider search. A member services representative will be with you shortly." |
| MemberServices | "We are happy to assist you. A member services representative will be with you shortly." |

---

## Known Gaps

### Screen pop gaps

The AttributeBar `Caller` field shows the caller's first and last name when the ANI lookup identified them, or **"Unidentified Member"** when the lookup found no profile. This is set by `CheckCallerIdentified` → `SetCallerName` / `SetCallerNameUnknown` before `RouteToQueue`. Agents immediately know whether they're speaking with an identified member or an unknown caller.

**Gap:** `[gap]` If the ANI lookup found no profile, `memberId`, `planId`, and `coverageStatus` are all empty in the AttributeBar alongside "Unidentified Member". No additional indicator distinguishes a profile miss from a data gap within a found profile.

**Gap:** `[gap]` If a Lex slot was null (caller didn't provide a claim number, invoice number, etc.), the corresponding slot attribute is empty and the Lambda returned `found=false`. The agent sees blank slot fields and blank result fields — no indication of whether the lookup was attempted. Adding a `lookupAttempted` attribute would help agents distinguish "IVR didn't try" from "IVR tried and failed."

**Gap:** `[gap]` The Detail view `Actions` buttons ("Transfer", "End Call") are rendered in the view but are not wired to any flow logic. They are display elements only — the call has already been transferred to the agent by the time the view renders. These buttons could be wired to a step-by-step guide flow to trigger follow-up actions (e.g., initiate a callback, open a case), but that requires a separate guide flow and `SetEventFlow` configuration.

### Workspace gaps

**Gap:** `[gap]` No routing profiles configured via IaC. All agents are on the default routing profile. Domain-specific routing profiles (claims agents, billing agents, pharmacy agents) would enable skill-based routing and per-queue SLA tracking.

**Gap:** `[gap]` No security profiles configured via IaC. Agents use the default security profile.

**Gap:** `[gap]` No quick connects configured. Agents who need to transfer to a specialist or supervisor have no pre-configured transfer targets — they must know extension numbers or search manually.

**Gap:** `[gap]` No Contact Lens real-time rules configured. Sensitive data (PII, payment card numbers) spoken during a call is not automatically redacted from recordings or transcripts.

---

## Summary: Items by Status

### Live and working
- Screen pop at answer time (Detail view, 7 intents, via ShowView in flow)
- Caller name in AttributeBar — identified callers show first + last name, unidentified callers show "Unidentified Member"
- Caller identity in AttributeBar (Member ID, Plan, Coverage, Language)
- Caller intent in Sections (callReason + slot values)
- Lambda lookup results in Sections (`external*` attributes — when lookup succeeded)
- Domain queue routing (agents receive calls from intent-specific queues)
- Intent-specific hold messaging (callers hear relevant message while waiting)

### Gaps in live agent experience
- No additional indicator when caller was unrecognized beyond "Unidentified Member" label — remaining AttributeBar fields (memberId, planId, coverage) are blank
- No indicator when Lex slot was null vs. lookup genuinely returned not-found
- View Action buttons not wired to follow-up flows
- No IaC routing profiles (all agents on default)
- No IaC security profiles
- No quick connects
- No Contact Lens PII redaction rules

### Not yet implemented (planned)
- Bedrock post-call summarization — EventBridge on disconnect → Lambda → Bedrock → write summary to S3, surface in agent workspace after-contact work
