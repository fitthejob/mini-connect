# CX State

Tracks the current caller experience at every node of the main inbound flow, documents known gaps, and records planned improvements. Updated as the flow evolves.

**Status key:**
- `[live]` — deployed and working as described
- `[gap]` — known deficiency in the current implementation
- `[planned]` — improvement scoped and ready to implement
- `[future]` — acknowledged but not yet scoped

---

## Flow Entry and Language Selection

### SetDefaultVoice → LanguagePrompt `[live]`
Joanna Neural is set before any TTS plays. Lex prompt asks the caller to press or say 1 for English, 2 for Spanish. Timeout and no-match both fall through to CheckHours defaulting to English.

**Gap:** `[gap]` No spoken fallback if the caller says something other than 1 or 2 (e.g., "hello?"). They hear silence and get routed as English. Acceptable for now but a re-prompt loop would improve first impressions.

---

## Hours Check

### CheckHours → CompareHours `[live]`
`hrs_of_ops` Lambda runs silently. If it errors, the flow fails open to Greeting (assumes open). Closed path plays a bilingual message and disconnects.

**Gap:** `[gap]` No "one moment" message before the Lambda invocation. There is a ~1 second pause with silence while the Lambda cold-starts. Low impact here because it's the first Lambda call and callers are still orienting to the IVR.

---

## ANI Lookup (Customer Profiles)

### LookupByPhone `[live]`
`GetCustomerProfile` block identifies the caller by phone number (ANI). On success, `$.Customer.FirstName`, `$.Customer.LastName`, `$.Customer.Attributes.memberId`, `$.Customer.Attributes.planId`, and `$.Customer.Attributes.coverageStatus` are available for the rest of the call. All error branches (NoneFoundError, MultipleFoundError, default) fail open to Greeting — no caller is stranded by a profile miss.

**Gap:** `[gap]` Greeting says "Welcome to Mini Connect" regardless of whether the ANI lookup succeeded. A recognized caller should be greeted by name: *"Welcome back, James."* An unrecognized caller gets the generic greeting. Personalization here sets a materially different tone.

**Gap:** `[gap]` If `memberId` or `planId` is missing from the profile (profile exists but fields are incomplete), downstream Lambda lookups will silently fail with `found=false`. There is no mid-flow check for profile completeness.

**Security gap:** `[gap]` ANI lookup identifies the caller but does not authenticate them. A caller with access to a member's phone can impersonate that member and receive PHI (claim status, denial reasons, invoice amounts, formulary details). The current model is identification-only — appropriate for low-risk read operations in a reference implementation, but a production deployment requires a second factor (member ID + date of birth DTMF, or a one-time SMS code) before any PHI is read back. This verification step would sit between `LookupByPhone` and `Greeting` in the main inbound flow.

---

## Intent Capture (Lex)

### SetIntentPromptLanguage → IntentPromptEnglish / IntentPromptSpanish `[live]`
Language branch routes to the correct Lex locale. Seven domain intents are available. Timeout and no-match route to SetSupportQueueFlow.

**Gap:** `[gap]` No confirmation of what the IVR understood before proceeding. If Lex transcribes a claim number or medication name incorrectly, the caller has no opportunity to correct it before the lookup runs.

**Gap:** `[gap]` If Lex fails to capture a required slot (caller says "I don't know my claim number"), the slot value is null. The flow passes null to the Lambda, which returns `found=false`. The caller hears "we couldn't find your record" — indistinguishable from a genuine not-found. These are two different failure modes.

**Gap:** `[gap]` No "one moment" message before any Lambda invocation. After Lex returns an intent, there is a 1–2 second silence while the Lambda runs. Callers interpret silence as a dropped call. A brief acknowledgment ("One moment while I look that up") fills this gap and sets expectations.

---

## Eligibility Intent `[live]`

### Path: SetIntentEligibility → InvokeEligibilityModule → CheckCoverageStatus[En|Es]

Coverage status is read directly from `$.Customer.Attributes.coverageStatus` set by the ANI lookup — no Lambda required. Four outcomes: ACTIVE, SUSPENDED, PENDING, unknown.

| Outcome | Current behavior | CX notes |
|---------|-----------------|-----------|
| ACTIVE | Reads back "coverage is active" + offers transfer | `[live]` Good self-service. |
| SUSPENDED | Reads back suspended message + auto-transfers | `[live]` Correct — suspended needs agent. |
| PENDING | Reads back pending message + offers transfer | `[live]` Acceptable. Could include expected activation timeframe. |
| Unknown | Reads back "cannot locate" + auto-transfers | `[live]` Acceptable fallback. |

**Gap:** `[gap]` ACTIVE message does not include plan name or effective date. *"Your Gold plan coverage is active as of January 1st"* is more reassuring than a bare status confirmation.

**Gap:** `[gap]` PENDING message gives no timeframe. *"Coverage is pending — it may take a few business days"* is vague. If effective date is available in the profile, use it.

---

## Claims Status Intent `[live]`

### Current state
`SetIntentClaims` stores `callReason=claims_status`, `slotClaimNumber`, `slotDateOfService`, then invokes `ClaimsModule`. The module invokes the ClaimsLookup Lambda (composite key `claimId + memberId`), persists Lambda results as contact attributes, reads back status, and offers agent transfer.

### Live flow
```
SetIntentClaims
  → InvokeClaimsModule
      → ClaimsLanguageCheck → BridgeMessage[En|Es] ("One moment while I look up that claim.")
      → InvokeClaimsLookup
          → error → ClaimsLookupError[En|Es] → SetNeedsTransfer → EndModule
      → CompareClaimsFound
          → false → ClaimsNotFound[En|Es] → SetNeedsTransfer → EndModule
      → PersistClaimsResults (externalStatus, externalDateOfService, externalBilledAmount, externalPaidAmount, externalDenialReason)
      → CompareClaimsStatus
          → "APPROVED" → bilingual message (paidAmount, billedAmount, dateOfService) → OfferTransferClaims
          → "DENIED"   → bilingual message (denialReason) → OfferTransferClaims
          → "PENDING"  → bilingual message (dateOfService, under review) → OfferTransferClaims
          → NoMatchingCondition → SetNeedsTransfer → EndModule
  → CheckNeedsTransfer → queue or disconnect
```

**Gap:** `[gap]` No null-check on `slotClaimNumber` before the Lambda call. If Lex didn't capture the claim number, the Lambda returns `found=false` and the caller hears "we couldn't locate that claim" — indistinguishable from a genuine not-found. These are two different failure modes that deserve different messages.

**Gap:** `[gap]` No confirmation of what the IVR understood before looking up. Claim numbers are easy to mishear ("CLM-2024-0047"). Callers have no opportunity to correct a bad transcription before the lookup runs.

---

## Benefits Inquiry Intent `[live]` — routes to queue, no self-service planned

### Current state
`SetIntentBenefits` stores `callReason=benefits_inquiry`, `slotServiceType`, plays a bilingual bridge message, then routes to `SetSupportQueueFlow`. Benefits are too complex and variable to self-serve via IVR.

Live bridge: *"Let me connect you with a benefits specialist."* / *"Permítame conectarlo con un especialista en beneficios."*

**Future:** `[future]` If a benefits summary table is added to the data model, simple tier/deductible lookups could be self-served.

---

## Prior Authorization Intent `[live]`

### Current state
`SetIntentPriorAuth` stores `callReason=prior_authorization`, `slotProcedureCode`, `slotProviderName`, then invokes `PriorAuthModule`. The module invokes ProcedureLookup Lambda, persists results, and branches on coverage and prior auth requirement.

### Live flow
```
SetIntentPriorAuth
  → InvokePriorAuthModule
      → PriorAuthLanguageCheck → BridgeMessage[En|Es] ("One moment while I check coverage for that procedure.")
      → InvokeProcedureLookup
          → error → PriorAuthLookupError[En|Es] → SetNeedsTransfer → EndModule
      → CompareProcedureFound
          → false → PriorAuthCodeNotFound[En|Es] → SetNeedsTransfer → EndModule
      → PersistPriorAuthResults (externalCovered, externalRequiresPriorAuth, externalDescription)
      → CompareProcedureCovered
          → false → ProcedureNotCovered[En|Es] → SetNeedsTransfer → EndModule
      → CompareProcedurePriorAuth
          → "true"  → PriorAuthRequired[En|Es] → SetNeedsTransfer → EndModule (auto-transfer)
          → "false" → ProcedureCoveredNoPriorAuth[En|Es] → OfferTransferPriorAuth
  → CheckNeedsTransfer → queue or disconnect
```

Auto-transfer on `requiresPriorAuth=true` — callers pre-surgical need immediate agent action, no choice offered.

**Gap:** `[gap]` No null-check on `slotProcedureCode`. If Lex didn't capture the code, the Lambda returns `found=false` and the caller hears a generic not-found message rather than a prompt to provide the code.

---

## Provider Lookup Intent `[live]`

### Current state
`SetIntentProviderLookup` stores `callReason=provider_lookup`, `slotSpecialty`, `slotZipCode`, `slotProviderName`, then invokes `ProviderModule`. The module invokes ProviderLookup Lambda by name or specialty+zip, persists results, and reads back in-network status and phone number.

### Live flow
```
SetIntentProviderLookup
  → InvokeProviderModule
      → ProviderLanguageCheck → BridgeMessage[En|Es] ("One moment while I check your network.")
      → InvokeProviderLookup
          → error → ProviderLookupError[En|Es] → SetNeedsTransfer → EndModule
      → CompareProviderFound
          → false → ProviderNotFound[En|Es] → SetNeedsTransfer → EndModule
      → PersistProviderResults (externalName, externalPhone, externalInNetwork)
      → ProviderFoundLanguageCheck → ProviderFound[En|Es] (name + phone) → OfferTransferProvider
  → CheckNeedsTransfer → queue or disconnect
```

Phone number only is read over TTS — addresses are not (too long to be useful over voice).

**Gap:** `[gap]` No null-check before the Lambda call. If Lex captured neither a provider name nor specialty+zip, the Lambda returns `found=false` and the caller hears the not-found message rather than a prompt for more information.

---

## Prescription / Formulary Intent `[live]`

### Current state
`SetIntentPrescription` stores `callReason=prescription`, `slotMedicationName`, then invokes `FormularyModule`. The module invokes FormularyLookup Lambda with `planId` + `medicationName` (planId comes from the ANI lookup — callers never state their plan). Persists results, branches on coverage and prior auth requirement.

### Live flow
```
SetIntentPrescription
  → InvokeFormularyModule
      → FormularyLanguageCheck → BridgeMessage[En|Es] ("One moment while I check your plan's formulary.")
      → InvokeFormularyLookup
          → error → FormularyLookupError[En|Es] → SetNeedsTransfer → EndModule
      → CompareFormularyFound
          → false → MedicationNotCovered[En|Es] → SetNeedsTransfer → EndModule
      → PersistFormularyResults (externalMedicationName, externalCovered, externalTier, externalCopay, externalRequiresPriorAuth)
      → CompareFormularyCovered
          → false → MedicationNotCovered[En|Es] → SetNeedsTransfer → EndModule
      → CompareFormularyPriorAuth
          → "true"  → MedicationCoveredPriorAuth[En|Es] → SetNeedsTransfer → EndModule (auto-transfer)
          → "false" → MedicationCovered[En|Es] (tier + copay) → OfferTransferFormulary
  → CheckNeedsTransfer → queue or disconnect
```

**Gap:** `[gap]` No null-check on `slotMedicationName` before the Lambda call. If Lex didn't capture the medication name, the Lambda returns `found=false`.

**Gap:** `[gap]` Medication name normalization — callers may say "metformin HCl" or "metformin ER" and the formulary lookup may not match. The flow cannot fix this; it requires Lex slot synonym expansion and richer formulary data.

---

## Billing Intent `[live]`

### Current state
`SetIntentBilling` stores `callReason=billing`, `slotInvoiceNumber`, then invokes `BillingModule`. The module invokes BillingLookup Lambda (composite key `invoiceId + memberId`), persists results, and branches on invoice status. OVERDUE auto-transfers — no choice offered.

### Live flow
```
SetIntentBilling
  → InvokeBillingModule
      → BillingLanguageCheck → BridgeMessage[En|Es] ("One moment while I pull up your invoice.")
      → InvokeBillingLookup
          → error → BillingLookupError[En|Es] → SetNeedsTransfer → EndModule
      → CompareBillingFound
          → false → InvoiceNotFound[En|Es] → SetNeedsTransfer → EndModule
      → PersistBillingResults (externalStatus, externalAmount, externalDateIssued, externalDueDate, externalDescription)
      → CompareBillingStatus
          → "PAID"    → InvoicePaid[En|Es] (amount + dateIssued + description) → OfferTransferBilling
          → "UNPAID"  → InvoiceUnpaid[En|Es] (amount + dueDate + description) → OfferTransferBilling
          → "OVERDUE" → InvoiceOverdue[En|Es] (amount + dueDate) → SetNeedsTransfer → EndModule (auto-transfer)
          → NoMatchingCondition → SetNeedsTransfer → EndModule
  → CheckNeedsTransfer → queue or disconnect
```

OVERDUE skips the offer-transfer prompt — past-due balance needs immediate agent resolution.

**Gap:** `[gap]` No null-check on `slotInvoiceNumber` before the Lambda call. If Lex didn't capture the invoice number, the Lambda returns `found=false`.

---

## Queue Transfer and Hold Experience

### RouteToQueue → SetXxxQueueFlow → SetXxxQueue → TransferToQueue `[live]`

`RouteToQueue` reads `callReason` and routes to one of 5 domain queues, each with its own bilingual hold experience. All fallback paths (benefits, eligibility auto-transfer, intent timeout, module errors) land in member-services.

| callReason | Queue | Hold message |
|---|---|---|
| `claims_status` | Claims | "We are happy to assist you with your claim..." |
| `billing` | Billing | "We are happy to assist you with your billing question..." |
| `prescription` | Pharmacy | "We are happy to assist you with your prescription..." |
| `prior_authorization` | Pharmacy | "We are happy to assist you with your prescription..." |
| `provider_lookup` | Provider | "We are happy to assist you with your provider search..." |
| all others | Member Services | "We are happy to assist you..." |

**Gap:** `[gap]` QueueAtCapacity → silent Disconnect. A caller who completed self-service and was transferred hits a wall if the queue is full — no message, no callback offer, no explanation. Should play a message and offer a callback before disconnecting.

**Gap:** `[gap]` No spoken bridge between the last self-service message and queue transfer. After a module reads back a result (e.g., claim status), there is a brief silence before hold music starts. A short transition — *"Let me connect you with a specialist"* — before `RouteToQueue` would close this gap.

**Gap:** `[gap]` OfferTransfer timeout/no-match in all 5 modules routes to EndModule with `needsTransfer` unset → parent CheckNeedsTransfer sees NoMatchingCondition → silent Disconnect. Callers who don't press in time (bad connection, elderly callers, confusion) are dropped. Should default to SetNeedsTransfer.

**Gap:** `[gap]` Eligibility OfferTransfer timeout/no-match → Disconnect. Same issue as above but in MainInbound directly. Should route to RouteToQueue.

---

## Agent Experience

> **Note:** Agents are customers too. The quality of the agent experience directly determines the quality of the caller experience — an agent who arrives at a call without context, has to re-ask questions the IVR already answered, or navigates a cluttered workspace is slower, more error-prone, and less able to help. Every gap documented here has a corresponding caller impact.

### Agent Workspace API Surface

Most of the agent workspace visual layout is **not exposed via any API** — panel order, tab visibility, and workspace layout are console-only in Connect today. What is programmable:

| Capability | API available | IaC via CDK |
|---|---|---|
| Step-by-Step Guide views (`CfnView`) | Yes | Yes — this is the primary tool |
| Routing profiles | Yes | Yes (`CfnRoutingProfile`) |
| Security profiles | Yes | Yes (`CfnSecurityProfile`) |
| Quick connects | Yes | Yes (`CfnQuickConnect`) |
| Agent statuses | Yes | Yes (`CfnAgentStatus`) |
| Contact Lens real-time alerts | Yes | Yes (`CfnRule`) |
| Workspace panel layout | No | No |
| Q in Connect association | No | No |
| Third-party app workspace layout | Partial | Partial |

**`CfnView` (Step-by-Step Guides) is where the heavy lifting happens.** It is the only IaC mechanism that controls what agents *see* when they answer — structured caller context, lookup results, and action buttons rendered as a UI card the moment the call connects. Everything else via API is routing and permissions, not visual workspace experience.

**Gap:** `[gap]` Contact attributes (`callReason`, `slotClaimNumber`, `externalStatus`, etc.) are set in the flow and available to agents in the Connect workspace, but no view is configured. Agents see raw attribute names rather than a formatted card. Until `MiniConnect-AgentView` is built, agents must re-ask callers for information the IVR already collected.

Lambda lookup results are now persisted as contact attributes before queue transfer (`externalStatus`, `externalPaidAmount`, `externalDenialReason`, etc. — see `external*` attributes in each module). The data is present; the view to surface it is not yet built.

---

## Agent Workspace Screen Pop `[live]`

### Implementation

`ShowView` blocks in `MainInbound` fire the AWS-managed **Detail view** for every intent at the moment the agent answers. No custom `CfnView` stack or CDK resource required — the Detail view is a global AWS-managed resource available on every Connect instance at `arn:aws:connect:region:aws:view/detail`.

`RouteToQueue` branches on `callReason` to 7 `ShowXxxView` blocks (one per intent). Each block passes contact attributes as ViewData, fires the screen pop, then continues to the domain queue setup regardless of agent action. The view is informational — it does not gate routing.

### What agents see at answer time

**AttributeBar (persistent header strip):**
| Field | Source |
|-------|--------|
| Member ID | `$.Attributes.memberId` |
| Plan | `$.Attributes.planId` |
| Coverage | `$.Attributes.coverageStatus` |
| Language | `$.Attributes.preferredLanguage` |

**Sections body (intent-specific):**

| Intent | Caller Intent section | Lookup Result section |
|--------|----------------------|----------------------|
| Claims | callReason, slotClaimNumber, slotDateOfService | externalStatus, externalBilledAmount, externalPaidAmount, externalDenialReason, externalDateOfService |
| Billing | callReason, slotInvoiceNumber | externalStatus, externalAmount, externalDateIssued, externalDueDate, externalDescription |
| Formulary | callReason, slotMedicationName | externalMedicationName, externalCovered, externalTier, externalCopay, externalRequiresPriorAuth |
| Provider | callReason, slotProviderName, slotSpecialty, slotZipCode | externalName, externalPhone, externalInNetwork |
| Prior Auth | callReason, slotProcedureCode, slotProviderName | externalCovered, externalRequiresPriorAuth, externalDescription |
| Eligibility | callReason | coverageStatus, memberId, planId |
| Benefits | callReason, slotServiceType | (no Lambda — benefits routes directly to queue) |

The AttributeBar `Caller` field shows the caller's first and last name when the ANI lookup identified them, or "Unidentified Member" when no profile was found. Set by `CheckCallerIdentified` → `SetCallerName` / `SetCallerNameUnknown` before `RouteToQueue`.

**Gap:** `[gap]` The Detail view `Actions` are static strings ("Transfer", "End Call"). They do not trigger any routing in the flow — they are display-only. A caller who triggers "End Call" from the view would still be transferred to queue because the flow's routing has already executed. The view is screen-pop-only, not an interactive decision surface.

---

## Known Lex / Slot Design Gaps (Out of Flow Scope)

These gaps exist in the bot design and cannot be fixed in the flow alone. Documented here for completeness.

| Gap | Description | Fix location |
|-----|-------------|--------------|
| Claim number speech recognition | "CLM-2024-0047" is hard to say and transcribe accurately | Lex slot — add DTMF fallback, allow numeric-only variant |
| Invoice number format | Same issue as claim numbers | Lex slot — add DTMF fallback |
| Medication name variants | "metformin HCl", "metformin ER" won't match "metformin" in the formulary | Lex slot synonyms + formulary data enrichment |
| Procedure code by description | Callers say "knee replacement" not "27447" | Lex slot — map common procedure descriptions to codes |
| No re-prompt on Lex failure | One shot at intent capture, then falls to queue | Lex session — add retry count and re-prompt before fallback |

---

## Summary: Items by Status

### Live and working
- Language selection (English/Spanish)
- Hours check with bilingual closed message
- ANI-based caller identification (Customer Profiles)
- Eligibility self-service (4 outcomes, bilingual)
- Claims self-service (ClaimsLookup Lambda, 3-outcome branch, bilingual messages)
- Billing self-service (BillingLookup Lambda, 3-outcome branch, bilingual messages, OVERDUE auto-transfer)
- Formulary self-service (FormularyLookup Lambda, 3-outcome branch, bilingual messages)
- Provider network lookup (ProviderLookup Lambda, 2-outcome branch, bilingual messages)
- Prior authorization check (ProcedureLookup Lambda, 3-outcome branch, bilingual messages, prior-auth-required auto-transfer)
- Lambda results persisted as contact attributes before queue transfer (`external*` attributes)
- All intent capture via Lex (7 intents)
- Contact attribute storage for agent screen pop
- Bilingual bridge messages before all Lambda invocations
- Spoken bridge before benefits queue transfer
- Per-intent queue routing (5 domain queues via RouteToQueue on callReason)
- Bilingual intent-specific hold experiences (claims, billing, pharmacy, provider, member-services)
- Agent screen pop at answer time (AWS-managed Detail view via ShowView, 7 intents)
- Caller name on screen pop — identified callers show first + last name, unidentified show "Unidentified Member"
- OfferTransfer timeout/no-match routes to queue instead of silent disconnect (all 6 modules)
- QueueAtCapacity plays bilingual message before disconnect
- Eligibility extracted to EligibilityModule — main inbound flow is now a pure orchestration spine

### Gaps in live flows
- No personalized greeting using caller's name from ANI lookup
- No null-check for missing slot values before Lambda calls — null slot returns `found=false`, indistinguishable from genuine not-found
- No confirmation of what the IVR understood before looking up (claim numbers, medication names)
- No spoken bridge between last self-service message and queue transfer (silence before hold music)
- Medication name normalization — "metformin HCl" and "metformin ER" won't match "metformin" in the formulary
- Agent screen pop does not surface caller name — Detail view AttributeBar requires a pre-concatenated attribute; `$.Customer.FirstName`/`LastName` are not currently merged into one
- Agent screen pop Actions ("Transfer", "End Call") are display-only, not wired to flow routing

### Not yet implemented (planned)
- Bedrock post-call summarization — EventBridge on disconnect → Lambda → Bedrock → S3
- Caller name on agent screen pop — add `UpdateContactAttributes` block before `RouteToQueue` to set a `callerName` attribute from ANI lookup fields

### Future / out of scope
- Dedicated per-intent queues with skill-based routing
- Dynamic hold messaging per intent
- Benefits self-service (requires benefits data model)
- Lex slot design improvements (DTMF fallbacks, medication synonyms, procedure descriptions)
- Customer Profiles data ingestion from DynamoDB (AppFlow or stream Lambda)
