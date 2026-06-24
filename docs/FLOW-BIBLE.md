# Flow Bible

Complete documentation of every Amazon Connect flow and module deployed in mini-connect. Describes the caller experience at each step, the exact TTS script, the branching logic, and the contact attributes set or consumed at every node.

**Flows covered:**
- [MainInbound](#maininbound-contact_flow) — primary inbound flow
- [SupportQueueExperience](#supportqueueexperience-customer_queue) — fallback hold loop (not currently routed)
- [ClaimsQueueExperience](#claimsqueueexperience-customer_queue)
- [BillingQueueExperience](#billingqueueexperience-customer_queue)
- [PharmacyQueueExperience](#pharmacyqueueexperience-customer_queue)
- [ProviderQueueExperience](#providerqueueexperience-customer_queue)
- [MemberServicesQueueExperience](#memberservicesqueueexperience-customer_queue)
- [ClaimsModule](#claimsmodule-contact_flow_module)
- [BillingModule](#billingmodule-contact_flow_module)
- [FormularyModule](#formularymodule-contact_flow_module)
- [ProviderModule](#providermodule-contact_flow_module)
- [PriorAuthModule](#priorauthmodule-contact_flow_module)
- [EligibilityModule](#eligibilitymodule-contact_flow_module)

**Source files:** `src/flows/main-inbound.ts`, `src/flows/support-queue-experience.ts`, `src/flows/queue-experiences/`, `src/flows/modules/`

**MainInbound sections:** Call setup (blocks 1–14) → Intent capture (15–19) → Module dispatch (20–35) → Post-module routing (36–52) → Queue setup (53–68)

---

## MainInbound (`CONTACT_FLOW`)

Entry point for every inbound call. Handles language selection, hours check, ANI-based caller identification, intent capture via Lex, and routing — either to a domain self-service module or directly to the support queue.

### Block-by-block walkthrough

---

#### SetDefaultVoice
**Type:** UpdateContactTextToSpeechVoice

Sets Joanna Neural as the TTS voice before any audio plays. This is necessary because the default Connect voice is not Neural. Must be the very first block so the language prompt is spoken in the correct voice.

**Attributes set:** none  
**Next:** LanguagePrompt

---

#### LanguagePrompt
**Type:** ConnectParticipantWithLexBot  
**Bot:** MainInbound Lex bot (en_US / es_US)

**Caller hears:**
> "For English, press or say 1. Para español, oprima o diga 2."

Accepts speech or DTMF. The Lex bot handles both simultaneously. Session attribute `x-amz-lex:locale-id` is not set here — the bot defaults to both locales.

| Lex intent matched | Next block |
|--------------------|------------|
| EnglishIntent | SetEnglishAttr |
| SpanishIntent | SetSpanishAttr |
| InputTimeLimitExceeded | CheckHours (defaults to English) |
| NoMatchingCondition | CheckHours (defaults to English) |

---

#### SetEnglishAttr → SetVoiceEnglish
**Type:** UpdateContactAttributes → UpdateContactTextToSpeechVoice

Sets `preferredLanguage=en`. Confirms Joanna Neural voice (already set, but explicit for clarity).

**Attributes set:** `preferredLanguage = "en"`  
**Next:** CheckHours

---

#### SetSpanishAttr → SetVoiceSpanish
**Type:** UpdateContactAttributes → UpdateContactTextToSpeechVoice

Sets `preferredLanguage=es`. Switches TTS to Lupe Neural.

**Attributes set:** `preferredLanguage = "es"`  
**Next:** CheckHours

---

#### CheckHours
**Type:** InvokeLambdaFunction  
**Lambda:** `hrs_of_ops`

Silently calls the `hrs_of_ops` Lambda. The Lambda checks Eastern Time business hours (Monday–Friday, 9am–5pm) with federal holiday observance rules.

Returns `$.External.isBusinessHours = "true"` or `"false"`.

**On Lambda error:** fails open to Greeting (assumes open — callers are never stranded by a Lambda failure).  
**Next:** CompareHours

---

#### CompareHours
**Type:** Compare  
**Compares:** `$.External.isBusinessHours`

| Value | Next block |
|-------|------------|
| "true" | LookupByPhone |
| NoMatchingCondition | CheckLanguageForClosed |

---

#### CheckLanguageForClosed → ClosedMessage[En\|Es]
**Type:** Compare → MessageParticipant

Branches on `$.Attributes.preferredLanguage` to play the closed message in the caller's chosen language.

**English caller hears:**
> "Thank you for calling Mini Connect. Our offices are currently closed. Our business hours are Monday through Friday, 9am to 5pm Eastern Time. Please call back during business hours."

**Spanish caller hears:**
> "Gracias por llamar a Mini Connect. Nuestras oficinas están actualmente cerradas. Nuestro horario de atención es de lunes a viernes, de 9am a 5pm hora del Este. Por favor llame de vuelta durante el horario de atención."

**Next:** Disconnect

---

#### LookupByPhone
**Type:** GetCustomerProfile  
**Source:** `$.CustomerEndpoint.Address` (ANI — the caller's phone number)  
**Domain:** Customer Profiles (`mini-connect-dev`)

Identifies the caller by their inbound phone number before they say a word. On success, populates `$.Customer.*` for the rest of the call.

**Fields retrieved:**
| Connect path | Description |
|---|---|
| `$.Customer.FirstName` | Caller's first name |
| `$.Customer.LastName` | Caller's last name |
| `$.Customer.Attributes.memberId` | Health plan member ID |
| `$.Customer.Attributes.planId` | Plan identifier |
| `$.Customer.Attributes.coverageStatus` | ACTIVE / SUSPENDED / PENDING |

**All error branches** (NoneFoundError, MultipleFoundError, default) fall through to Greeting — no caller is stranded by a profile miss. Unrecognized callers simply get the generic greeting and can still speak their intent.

**Next:** Greeting

---

#### Greeting
**Type:** MessageParticipant

**Caller hears:**
> "Welcome to Mini Connect."

Plays in the language and voice already set (Joanna or Lupe Neural). The greeting is generic — it does not use the caller's name from the ANI lookup.

**Next:** SetIntentPromptLanguage

---

#### SetIntentPromptLanguage
**Type:** Compare  
**Compares:** `$.Attributes.preferredLanguage`

Routes to the correct Lex locale for intent capture. Lex locale is a static parameter on the block — it cannot be set dynamically, so a language branch is required here.

| Value | Next block |
|-------|------------|
| "es" | IntentPromptSpanish |
| NoMatchingCondition | IntentPromptEnglish |

---

#### IntentPromptEnglish / IntentPromptSpanish
**Type:** ConnectParticipantWithLexBot  
**Bot:** MainInbound Lex bot  
**Locale:** en_US (English) or es_US (Spanish)

**English caller hears:**
> "How can I help you today? You can say things like: check my claim status, benefits question, prior authorization, find a provider, prescription help, check eligibility, or billing question."

**Spanish caller hears:**
> "¿Cómo puedo ayudarle hoy? Puede decir: estado de reclamación, pregunta sobre beneficios, autorización previa, buscar proveedor, ayuda con receta, verificar elegibilidad, o pregunta de facturación."

Accepts speech. Seven domain intents are available. Lex slot values captured here are available at `$.Lex.Slots.*` immediately after this block.

| Lex intent matched | Next block |
|--------------------|------------|
| ClaimsStatusIntent | SetIntentClaims |
| BenefitsInquiryIntent | SetIntentBenefits |
| PriorAuthorizationIntent | SetIntentPriorAuth |
| ProviderLookupIntent | SetIntentProviderLookup |
| PrescriptionIntent | SetIntentPrescription |
| EligibilityIntent | SetIntentEligibility |
| BillingIntent | SetIntentBilling |
| InputTimeLimitExceeded | SetSupportQueueFlow |
| NoMatchingCondition | SetSupportQueueFlow |

---

### Intent paths

---

#### Claims path

**SetIntentClaims**  
**Type:** UpdateContactAttributes

Stores the Lex slot values as contact attributes. These are available to agents and to the ClaimsModule Lambda.

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"claims_status"` |
| `slotClaimNumber` | `$.Lex.Slots.ClaimNumber` |
| `slotDateOfService` | `$.Lex.Slots.DateOfService` |

**Next:** InvokeClaimsModule

---

**InvokeClaimsModule**  
**Type:** InvokeFlowModule  
**Module:** ClaimsModule

Delegates to the ClaimsModule for Lambda invocation, result readback, and transfer offer. See [ClaimsModule](#claimsmodule-contact_flow_module).

On module error (module itself fails to execute): routes to SetSupportQueueFlow.  
**Next after module returns:** CheckNeedsTransfer

---

#### Benefits path

**SetIntentBenefits**  
**Type:** UpdateContactAttributes

Benefits are too complex and variable for IVR self-service — no Lambda invocation. Routes to queue with context stored for agent screen pop.

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"benefits_inquiry"` |
| `slotServiceType` | `$.Lex.Slots.ServiceType` |

**Next:** BenefitsTransferLanguageCheck

---

**BenefitsTransferLanguageCheck → BenefitsTransfer[En\|Es]**  
**Type:** Compare → MessageParticipant

**English caller hears:**
> "Let me connect you with a benefits specialist."

**Spanish caller hears:**
> "Permítame conectarlo con un especialista en beneficios."

**Next:** SetSupportQueueFlow

---

#### Prior Authorization path

**SetIntentPriorAuth**  
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"prior_authorization"` |
| `slotProcedureCode` | `$.Lex.Slots.ProcedureCode` |
| `slotProviderName` | `$.Lex.Slots.ProviderName` |

**Next:** InvokePriorAuthModule → CheckNeedsTransfer

---

#### Provider Lookup path

**SetIntentProviderLookup**  
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"provider_lookup"` |
| `slotSpecialty` | `$.Lex.Slots.Specialty` |
| `slotZipCode` | `$.Lex.Slots.ZipCode` |
| `slotProviderName` | `$.Lex.Slots.ProviderName` |

**Next:** InvokeProviderModule → CheckNeedsTransfer

---

#### Prescription / Formulary path

**SetIntentPrescription**  
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"prescription"` |
| `slotMedicationName` | `$.Lex.Slots.MedicationName` |

**Next:** InvokeFormularyModule → CheckNeedsTransfer

---

#### Eligibility path

Coverage status is read from `$.Customer.Attributes.coverageStatus` set by the ANI lookup — no Lambda required. Now handled by `EligibilityModule` (CONTACT_FLOW_MODULE), consistent with all other domain intents.

**SetIntentEligibility**  
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"eligibility"` |
| `slotMemberId` | `$.Lex.Slots.MemberId` |

**Next:** InvokeEligibilityModule → CheckNeedsTransfer

See [EligibilityModule](#eligibilitymodule-contact_flow_module) for the full outcome branch detail.

---

#### Billing path

**SetIntentBilling**  
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `callReason` | `"billing"` |
| `slotInvoiceNumber` | `$.Lex.Slots.InvoiceNumber` |

**Next:** InvokeBillingModule → CheckNeedsTransfer

---

### Post-module routing

---

#### CheckNeedsTransfer
**Type:** Compare  
**Compares:** `$.Attributes.needsTransfer`

All five self-service modules return here. Modules set `needsTransfer=true` when the caller needs an agent.

| Value | Next block |
|-------|------------|
| "true" | RouteToQueue |
| NoMatchingCondition | Disconnect (caller chose to end the call from an offer-transfer prompt) |

---

#### CheckCallerIdentified → SetCallerName / SetCallerNameUnknown
**Type:** Compare → UpdateContactAttributes (×2)

Sets the `callerName` attribute for the agent screen pop `AttributeBar`. `callerIdentified=true` is only set when `LookupByPhone` succeeded — all error branches skip it.

| callerIdentified | Next block | callerName set to |
|---|---|---|
| `"true"` | SetCallerName | `$.Customer.FirstName $.Customer.LastName` |
| NoMatchingCondition | SetCallerNameUnknown | `"Unidentified Member"` |

Both paths converge on `RouteToQueue`.

---

#### RouteToQueue
**Type:** Compare  
**Compares:** `$.Attributes.callReason`

Routes each intent to its `ShowView` screen pop block, which fires the agent workspace card before continuing to the domain queue. All fallback paths (benefits, eligibility, intent timeout, module errors) land in member-services via NoMatchingCondition.

| callReason | ShowView block | Queue |
|------------|---------------|-------|
| `claims_status` | ShowClaimsView | Claims |
| `billing` | ShowBillingView | Billing |
| `prescription` | ShowFormularyView | Pharmacy |
| `prior_authorization` | ShowPriorAuthView | Pharmacy |
| `provider_lookup` | ShowProviderView | Provider |
| `eligibility` | ShowEligibilityView | MemberServices |
| `benefits_inquiry` | ShowBenefitsView | MemberServices |
| NoMatchingCondition | SetMemberServicesQueueFlow | MemberServices |

---

#### ShowXxxView (7 blocks)
**Type:** ShowView  
**View:** AWS-managed Detail view (`detail`, `$LATEST`)  
**Invocation timeout:** 2 seconds

Fires the agent workspace screen pop the moment the call is answered. Uses the AWS-managed Detail view — no custom `CfnView` resource required. ViewData entries populate the view's input schema at runtime from contact attributes.

**Common ViewData fields (all intents):**
| ViewData key | Value |
|---|---|
| `Heading` | Intent-specific title (e.g. "Claims Status") |
| `AttributeBar` | Member ID, Plan, Coverage status, Language — always visible at top |
| `Sections` | Two DataSections: Caller Intent (slot values) + Lookup Result (`external*` attributes) |
| `Actions` | `["Transfer", "End Call"]` |

**Per-intent ViewData (Sections content):**

| Block | Heading | Caller Intent fields | Lookup Result fields |
|-------|---------|---------------------|---------------------|
| ShowClaimsView | Claims Status | callReason, slotClaimNumber, slotDateOfService | externalStatus, externalBilledAmount, externalPaidAmount, externalDenialReason, externalDateOfService |
| ShowBillingView | Billing Inquiry | callReason, slotInvoiceNumber | externalStatus, externalAmount, externalDateIssued, externalDueDate, externalDescription |
| ShowFormularyView | Prescription Formulary | callReason, slotMedicationName | externalMedicationName, externalCovered, externalTier, externalCopay, externalRequiresPriorAuth |
| ShowProviderView | Provider Network Lookup | callReason, slotProviderName, slotSpecialty, slotZipCode | externalName, externalPhone, externalInNetwork |
| ShowPriorAuthView | Prior Authorization | callReason, slotProcedureCode, slotProviderName | externalCovered, externalRequiresPriorAuth, externalDescription |
| ShowEligibilityView | Eligibility Check | callReason | coverageStatus, memberId, planId |
| ShowBenefitsView | Benefits Inquiry | callReason, slotServiceType | (none — no Lambda for benefits) |

On any outcome (agent clicks Transfer or End Call, or TimeLimitExceeded/NoMatchingCondition error), flow continues to the corresponding `SetXxxQueueFlow` block. The view is informational only — it does not gate routing.

---

#### SetXxxQueueFlow → SetXxxQueue → TransferToQueue
**Type:** SetCustomerQueueFlow → UpdateContactTargetQueue → TransferContactToQueue

One pair per queue (5 total). Each sets the intent-specific hold experience flow and the corresponding queue ARN, then converges on a single `TransferToQueue` block.

On `QueueAtCapacity`: plays a bilingual message then disconnects.

**English:** "We're sorry, all of our representatives are currently busy. Please call back during business hours and we will be happy to assist you."  
**Spanish:** "Lo sentimos, todos nuestros representantes están ocupados en este momento. Por favor llame de vuelta durante el horario de atención y con gusto le ayudaremos."

**Next after transfer:** Disconnect (reached only if the transfer itself fails)

---

#### Disconnect
**Type:** DisconnectParticipant

Ends the call. Reached from: closed message, caller pressing 2 on an offer-transfer prompt, eligibility SUSPENDED/unknown auto-transfer paths, QueueAtCapacity (after bilingual message), failed queue transfer.

---

## SupportQueueExperience (`CUSTOMER_QUEUE`)

Generic hold loop — deployed but not currently routed. No intent path in MainInbound sets this as the customer queue flow. Kept as a deployable fallback. If re-wired, callers hear a generic hold message with no intent context.

### Block-by-block walkthrough

---

#### CheckLanguage
**Type:** Compare  
**Compares:** `$.Attributes.preferredLanguage`

Voice settings do not carry over from the inbound flow into the queue flow — they must be re-established here.

| Value | Next block |
|-------|------------|
| "es" | SetVoiceSpanish |
| NoMatchingCondition | SetVoiceEnglish |

---

#### SetVoiceEnglish / SetVoiceSpanish
**Type:** UpdateContactTextToSpeechVoice

Sets Joanna Neural (English) or Lupe Neural (Spanish).

**Next:** HoldLoopEnglish / HoldLoopSpanish

---

#### HoldLoopEnglish / HoldLoopSpanish
**Type:** MessageParticipantIteratively

Loops the hold message repeatedly until an agent answers. Connect handles the loop internally — no explicit loop block needed.

**English caller hears (looping):**
> "Please hold while we connect you to the next available agent."

**Spanish caller hears (looping):**
> "Por favor espere mientras lo conectamos con el siguiente agente disponible."

---

## ClaimsQueueExperience (`CUSTOMER_QUEUE`)

Hold experience for the claims queue. Played when `callReason=claims_status` and the caller is transferred to the Claims queue.

**English caller hears (looping):**
> "We are happy to assist you with your claim. A claims specialist will be with you shortly. Please continue to hold."

**Spanish caller hears (looping):**
> "Nos da gusto ayudarle con su reclamo. Un especialista en reclamos lo atenderá en breve. Por favor, espere un momento."

Pattern: CheckLanguage → SetVoice[En|Es] → HoldLoop[En|Es] (MessageParticipantIteratively). Voice re-established on entry — not inherited from inbound flow.

---

## BillingQueueExperience (`CUSTOMER_QUEUE`)

Hold experience for the billing queue. Played when `callReason=billing`.

**English:** "We are happy to assist you with your billing question. A billing specialist will be with you shortly. Please continue to hold."

**Spanish:** "Nos da gusto ayudarle con su consulta de facturación. Un especialista en facturación lo atenderá en breve. Por favor, espere un momento."

---

## PharmacyQueueExperience (`CUSTOMER_QUEUE`)

Hold experience for the pharmacy queue. Played when `callReason=prescription` or `callReason=prior_authorization`. Both intents share this queue and hold experience.

**English:** "We are happy to assist you with your prescription. A pharmacy specialist will be with you shortly. Please continue to hold."

**Spanish:** "Nos da gusto ayudarle con su receta médica. Un especialista en farmacia lo atenderá en breve. Por favor, espere un momento."

---

## ProviderQueueExperience (`CUSTOMER_QUEUE`)

Hold experience for the provider queue. Played when `callReason=provider_lookup`.

**English:** "We are happy to assist you with your provider search. A member services representative will be with you shortly. Please continue to hold."

**Spanish:** "Nos da gusto ayudarle con su búsqueda de proveedores. Un representante de servicios para miembros lo atenderá en breve. Por favor, espere un momento."

---

## MemberServicesQueueExperience (`CUSTOMER_QUEUE`)

Hold experience for the member services queue. Played for `callReason=eligibility`, `callReason=benefits_inquiry`, and all fallback paths (intent timeout, no-match, module execution errors).

**English:** "We are happy to assist you. A member services representative will be with you shortly. Please continue to hold."

**Spanish:** "Nos da gusto ayudarle. Un representante de servicios para miembros lo atenderá en breve. Por favor, espere un momento."

---

## ClaimsModule (`CONTACT_FLOW_MODULE`)

Self-service claims status lookup. Invokes the ClaimsLookup Lambda, reads back claim status, and offers agent transfer.

**Lambda:** `claims_lookup`  
**Inputs consumed:** `$.Attributes.slotClaimNumber`, `$.Customer.Attributes.memberId`  
**Security:** composite key `(claimId, memberId)` — callers can only retrieve claims belonging to their own account

### Block-by-block walkthrough

---

#### ClaimsLanguageCheck
**Type:** Compare  
**Compares:** `$.Attributes.preferredLanguage`

| Value | Next block |
|-------|------------|
| "es" | ClaimsLookupBridgeSpanish |
| NoMatchingCondition | ClaimsLookupBridgeEnglish |

---

#### ClaimsLookupBridge[En\|Es]
**Type:** MessageParticipant

Fills the Lambda cold-start silence.

**English:** "One moment while I look up that claim."  
**Spanish:** "Un momento mientras busco esa reclamación."

**Next:** InvokeClaimsLookup

---

#### InvokeClaimsLookup
**Type:** InvokeLambdaFunction  
**Lambda:** ClaimsLookup  
**Timeout:** 8 seconds

Passes `slotClaimNumber` and `memberId` (from contact attributes) to the Lambda. The Lambda reads from DynamoDB and returns the claim record.

**On success:** CompareClaimsFound  
**On error:** ClaimsErrorLanguageCheck

---

#### ClaimsErrorLanguageCheck → ClaimsLookupError[En\|Es]
**Type:** Compare → MessageParticipant

**English:** "I'm having trouble retrieving your claim right now. Let me connect you with a representative."  
**Spanish:** "Tengo problemas para recuperar su reclamación en este momento. Permítame conectarlo con un representante."

**Next:** SetNeedsTransfer

---

#### CompareClaimsFound
**Type:** Compare  
**Compares:** `$.External.found`

| Value | Next block |
|-------|------------|
| "true" | PersistClaimsResults |
| NoMatchingCondition | ClaimsNotFoundLanguageCheck |

---

#### PersistClaimsResults
**Type:** UpdateContactAttributes

Saves Lambda results as contact attributes before any routing decision. These attributes are available to agents at answer time via the agent workspace.

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `externalStatus` | `$.External.status` |
| `externalDateOfService` | `$.External.dateOfService` |
| `externalBilledAmount` | `$.External.billedAmount` |
| `externalPaidAmount` | `$.External.paidAmount` |
| `externalDenialReason` | `$.External.denialReason` |

On UpdateContactAttributes error: falls through to CompareClaimsStatus (results not persisted, but call continues).  
**Next:** CompareClaimsStatus

---

#### ClaimsNotFoundLanguageCheck → ClaimsNotFound[En\|Es]
**Type:** Compare → MessageParticipant

**English:** "We weren't able to locate that claim for your account. A representative can help you find it."  
**Spanish:** "No pudimos encontrar esa reclamación en su cuenta. Un representante puede ayudarle a encontrarla."

**Next:** SetNeedsTransfer

---

#### CompareClaimsStatus
**Type:** Compare  
**Compares:** `$.External.status`

| Value | Next block |
|-------|------------|
| "APPROVED" | ClaimsApprovedLanguageCheck |
| "DENIED" | ClaimsDeniedLanguageCheck |
| "PENDING" | ClaimsPendingLanguageCheck |
| NoMatchingCondition | SetNeedsTransfer |

---

#### Claims status messages

Each status branches on language and plays a bilingual message. All three statuses offer an agent transfer.

**APPROVED**

| Language | Message |
|----------|---------|
| English | "Your claim was approved. Your plan paid \$.External.paidAmount of the \$.External.billedAmount billed for your visit on \$.External.dateOfService." |
| Spanish | "Su reclamación fue aprobada. Su plan pagó \$.External.paidAmount de los \$.External.billedAmount facturados por su visita del \$.External.dateOfService." |

Next: OfferTransferClaims[En\|Es]

**DENIED**

| Language | Message |
|----------|---------|
| English | "Your claim was denied. The reason given was: \$.External.denialReason. A representative can help you with next steps or an appeal." |
| Spanish | "Su reclamación fue denegada. El motivo fue: \$.External.denialReason. Un representante puede ayudarle con los próximos pasos o una apelación." |

Next: OfferTransferClaims[En\|Es]

**PENDING**

| Language | Message |
|----------|---------|
| English | "Your claim for the visit on \$.External.dateOfService is currently under review. No action is needed from you at this time." |
| Spanish | "Su reclamación por la visita del \$.External.dateOfService está actualmente en revisión. No se requiere ninguna acción de su parte en este momento." |

Next: OfferTransferClaims[En\|Es]

---

#### OfferTransferClaims[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "If you have additional questions about this claim, press 1 to speak with a representative. Press 2 to end the call."  
**Spanish:** "Si tiene preguntas adicionales sobre esta reclamación, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | EndModule ⚠️ silent drop |
| NoMatchingCondition | EndModule ⚠️ silent drop |

> **Known gap:** Timeout and no-match both end the module with `needsTransfer` unset. Parent `CheckNeedsTransfer` sees NoMatchingCondition → Disconnect. A caller who didn't press in time is silently dropped. Should route to SetNeedsTransfer instead.

---

#### SetNeedsTransfer
**Type:** UpdateContactAttributes

**Attributes set:** `needsTransfer = "true"`  
**Next:** EndModule

---

#### EndModule
**Type:** EndFlowModuleExecution

Returns control to MainInbound at CheckNeedsTransfer.

---

## BillingModule (`CONTACT_FLOW_MODULE`)

Self-service invoice lookup. Invokes BillingLookup Lambda, reads back invoice status and amount, offers agent transfer. OVERDUE invoices auto-transfer — no choice offered.

**Lambda:** `billing_lookup`  
**Inputs consumed:** `$.Attributes.slotInvoiceNumber`, `$.Customer.Attributes.memberId`  
**Security:** composite key `(invoiceId, memberId)`

### Block-by-block walkthrough

---

#### BillingLanguageCheck → BillingLookupBridge[En\|Es]
**Type:** Compare → MessageParticipant

**English:** "One moment while I pull up your invoice."  
**Spanish:** "Un momento mientras busco su factura."

**Next:** InvokeBillingLookup

---

#### InvokeBillingLookup
**Type:** InvokeLambdaFunction  
**Timeout:** 8 seconds

**On success:** CompareBillingFound  
**On error:** BillingErrorLanguageCheck

---

#### BillingErrorLanguageCheck → BillingLookupError[En\|Es]

**English:** "I'm having trouble retrieving your invoice right now. Let me connect you with our billing team."  
**Spanish:** "Tengo problemas para recuperar su factura ahora. Permítame conectarlo con nuestro equipo de facturación."

**Next:** SetNeedsTransfer

---

#### CompareBillingFound
**Type:** Compare  
**Compares:** `$.External.found`

| Value | Next block |
|-------|------------|
| "true" | PersistBillingResults |
| NoMatchingCondition | BillingNotFoundLanguageCheck |

---

#### PersistBillingResults
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `externalStatus` | `$.External.status` |
| `externalAmount` | `$.External.amount` |
| `externalDateIssued` | `$.External.dateIssued` |
| `externalDueDate` | `$.External.dueDate` |
| `externalDescription` | `$.External.description` |

**Next:** CompareBillingStatus

---

#### BillingNotFoundLanguageCheck → InvoiceNotFound[En\|Es]

**English:** "We weren't able to locate that invoice for your account. A billing representative can help you find it."  
**Spanish:** "No pudimos encontrar esa factura en su cuenta. Un representante de facturación puede ayudarle a encontrarla."

**Next:** SetNeedsTransfer

---

#### CompareBillingStatus
**Type:** Compare  
**Compares:** `$.External.status`

| Value | Next block |
|-------|------------|
| "PAID" | BillingPaidLanguageCheck |
| "UNPAID" | BillingUnpaidLanguageCheck |
| "OVERDUE" | BillingOverdueLanguageCheck |
| NoMatchingCondition | SetNeedsTransfer |

---

#### Billing status messages

**PAID**

| Language | Message |
|----------|---------|
| English | "Your invoice of \$.External.amount has been paid. It was issued on \$.External.dateIssued for \$.External.description." |
| Spanish | "Su factura de \$.External.amount ha sido pagada. Fue emitida el \$.External.dateIssued por \$.External.description." |

Next: OfferTransferBilling[En\|Es]

**UNPAID**

| Language | Message |
|----------|---------|
| English | "You have an outstanding invoice of \$.External.amount due on \$.External.dueDate for \$.External.description." |
| Spanish | "Tiene una factura pendiente de \$.External.amount con vencimiento el \$.External.dueDate por \$.External.description." |

Next: OfferTransferBilling[En\|Es]

**OVERDUE** — auto-transfer, no choice

| Language | Message |
|----------|---------|
| English | "You have a past-due balance of \$.External.amount that was due on \$.External.dueDate. I'll connect you with our billing team now." |
| Spanish | "Tiene un saldo vencido de \$.External.amount que venció el \$.External.dueDate. Ahora le conectaré con nuestro equipo de facturación." |

Next: SetNeedsTransfer (no offer-transfer prompt — past-due balance needs immediate agent resolution)

---

#### OfferTransferBilling[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "To speak with a billing representative, press 1. Press 2 to end the call."  
**Spanish:** "Para hablar con un representante de facturación, oprima 1. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | EndModule ⚠️ silent drop |
| NoMatchingCondition | EndModule ⚠️ silent drop |

> **Known gap:** Same silent drop issue as ClaimsModule. Timeout and no-match should route to SetNeedsTransfer.

---

#### SetNeedsTransfer → EndModule

Same pattern as ClaimsModule. Sets `needsTransfer=true`, returns to CheckNeedsTransfer in MainInbound.

---

## FormularyModule (`CONTACT_FLOW_MODULE`)

Prescription formulary coverage lookup. Invokes FormularyLookup Lambda with `planId` + `medicationName`, reads back tier, copay, and prior auth requirement.

**Lambda:** `formulary_lookup`  
**Inputs consumed:** `$.Customer.Attributes.planId`, `$.Attributes.slotMedicationName`  
**Note:** `planId` comes from the ANI lookup — callers never need to state their plan

### Block-by-block walkthrough

---

#### FormularyLanguageCheck → FormularyLookupBridge[En\|Es]

**English:** "One moment while I check your plan's formulary."  
**Spanish:** "Un momento mientras verifico el formulario de su plan."

**Next:** InvokeFormularyLookup

---

#### InvokeFormularyLookup
**Type:** InvokeLambdaFunction  
**Timeout:** 8 seconds

**On success:** CompareFormularyFound  
**On error:** FormularyErrorLanguageCheck

---

#### FormularyErrorLanguageCheck → FormularyLookupError[En\|Es]

**English:** "I'm having trouble checking your formulary right now. Let me connect you with our pharmacy team."  
**Spanish:** "Tengo problemas para verificar su formulario ahora. Permítame conectarlo con nuestro equipo de farmacia."

**Next:** SetNeedsTransfer

---

#### CompareFormularyFound
**Type:** Compare  
**Compares:** `$.External.found`

| Value | Next block |
|-------|------------|
| "true" | PersistFormularyResults |
| NoMatchingCondition | FormularyNotFoundLanguageCheck |

---

#### PersistFormularyResults
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `externalMedicationName` | `$.External.medicationName` |
| `externalCovered` | `$.External.covered` |
| `externalTier` | `$.External.tier` |
| `externalCopay` | `$.External.copay` |
| `externalRequiresPriorAuth` | `$.External.requiresPriorAuth` |

**Next:** CompareFormularyCovered

---

#### FormularyNotFoundLanguageCheck → MedicationNotCovered[En\|Es]

Used for both `found=false` and `covered=false` — the caller experience is the same either way.

**English:** "\$.External.medicationName isn't covered under your current plan. A representative can review covered alternatives with you."  
**Spanish:** "\$.External.medicationName no está cubierto bajo su plan actual. Un representante puede revisar con usted las alternativas cubiertas."

**Next:** SetNeedsTransfer

---

#### CompareFormularyCovered
**Type:** Compare  
**Compares:** `$.External.covered`

| Value | Next block |
|-------|------------|
| "true" | CompareFormularyPriorAuth |
| NoMatchingCondition | FormularyNotCoveredLanguageCheck (→ MedicationNotCovered) |

---

#### CompareFormularyPriorAuth
**Type:** Compare  
**Compares:** `$.External.requiresPriorAuth`

| Value | Next block |
|-------|------------|
| "true" | FormularyPriorAuthLanguageCheck |
| NoMatchingCondition | FormularyCoveredLanguageCheck |

---

#### Formulary outcome messages

**Covered, prior auth required** — auto-transfer to pharmacy team

| Language | Message |
|----------|---------|
| English | "\$.External.medicationName is covered under your plan, but requires prior authorization before it can be dispensed. I'll connect you with our pharmacy team to start that process." |
| Spanish | "\$.External.medicationName está cubierto bajo su plan, pero requiere autorización previa antes de ser dispensado. Le conectaré con nuestro equipo de farmacia para iniciar ese proceso." |

Next: SetNeedsTransfer

**Covered, no prior auth required**

| Language | Message |
|----------|---------|
| English | "\$.External.medicationName is covered under your plan. It's a Tier \$.External.tier medication with a \$.External.copay copay." |
| Spanish | "\$.External.medicationName está cubierto bajo su plan. Es un medicamento de Nivel \$.External.tier con un copago de \$.External.copay." |

Next: OfferTransferFormulary[En\|Es]

---

#### OfferTransferFormulary[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "If you have questions about this medication or your formulary, press 1 to speak with a representative. Press 2 to end the call."  
**Spanish:** "Si tiene preguntas sobre este medicamento o su formulario, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | EndModule ⚠️ silent drop |
| NoMatchingCondition | EndModule ⚠️ silent drop |

> **Known gap:** Same silent drop issue as ClaimsModule. Timeout and no-match should route to SetNeedsTransfer.

---

## ProviderModule (`CONTACT_FLOW_MODULE`)

Provider network status lookup. Invokes ProviderLookup Lambda by provider name or specialty+zip, confirms in-network status and reads back phone number.

**Lambda:** `provider_lookup`  
**Inputs consumed:** `$.Customer.Attributes.planId`, `$.Attributes.slotProviderName` or `$.Attributes.slotSpecialty` + `$.Attributes.slotZipCode`  
**Note:** Phone numbers are read over TTS; addresses are not (too long to be useful over voice)

### Block-by-block walkthrough

---

#### ProviderLanguageCheck → ProviderLookupBridge[En\|Es]

**English:** "One moment while I check your network."  
**Spanish:** "Un momento mientras verifico su red."

**Next:** InvokeProviderLookup

---

#### InvokeProviderLookup
**Type:** InvokeLambdaFunction  
**Timeout:** 8 seconds

**On success:** CompareProviderFound  
**On error:** ProviderErrorLanguageCheck

---

#### ProviderErrorLanguageCheck → ProviderLookupError[En\|Es]

**English:** "I'm having trouble checking provider network status right now. Let me connect you with a representative."  
**Spanish:** "Tengo problemas para verificar el estado de la red de proveedores. Permítame conectarlo con un representante."

**Next:** SetNeedsTransfer

---

#### CompareProviderFound
**Type:** Compare  
**Compares:** `$.External.found`

| Value | Next block |
|-------|------------|
| "true" | PersistProviderResults |
| NoMatchingCondition | ProviderNotFoundLanguageCheck |

---

#### PersistProviderResults
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `externalName` | `$.External.name` |
| `externalPhone` | `$.External.phone` |
| `externalInNetwork` | `$.External.inNetwork` |

**Next:** ProviderFoundLanguageCheck

---

#### ProviderNotFoundLanguageCheck → ProviderNotFound[En\|Es]

**English:** "That provider isn't currently in-network for your plan. I can connect you with a representative who can help you find an in-network alternative."  
**Spanish:** "Ese proveedor no está actualmente en la red de su plan. Puedo conectarlo con un representante que le ayude a encontrar una alternativa en la red."

**Next:** SetNeedsTransfer

---

#### ProviderFoundLanguageCheck → ProviderFound[En\|Es]

**English:** "\$.External.name is in-network for your plan. Their phone number is \$.External.phone. I can connect you with a representative to schedule an appointment or send you more details."  
**Spanish:** "\$.External.name está en la red de su plan. Su número de teléfono es \$.External.phone. Puedo conectarlo con un representante para programar una cita o enviarle más detalles."

**Next:** OfferTransferProvider[En\|Es]

---

#### OfferTransferProvider[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "Press 1 to speak with a representative. Press 2 to end the call."  
**Spanish:** "Oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | EndModule ⚠️ silent drop |
| NoMatchingCondition | EndModule ⚠️ silent drop |

> **Known gap:** Same silent drop issue as ClaimsModule. Timeout and no-match should route to SetNeedsTransfer.

---

## PriorAuthModule (`CONTACT_FLOW_MODULE`)

Prior authorization check for a procedure code. Invokes ProcedureLookup Lambda, reads back coverage and authorization requirement. Auto-transfers when prior auth is required — no choice offered (high-anxiety intent, immediate agent action needed).

**Lambda:** `procedure_lookup`  
**Inputs consumed:** `$.Attributes.slotProcedureCode`, `$.Customer.Attributes.planId`

### Block-by-block walkthrough

---

#### PriorAuthLanguageCheck → PriorAuthLookupBridge[En\|Es]

**English:** "One moment while I check coverage for that procedure."  
**Spanish:** "Un momento mientras verifico la cobertura para ese procedimiento."

**Next:** InvokeProcedureLookup

---

#### InvokeProcedureLookup
**Type:** InvokeLambdaFunction  
**Timeout:** 8 seconds

**On success:** CompareProcedureFound  
**On error:** PriorAuthErrorLanguageCheck

---

#### PriorAuthErrorLanguageCheck → PriorAuthLookupError[En\|Es]

**English:** "I'm having trouble checking that right now. Let me connect you with our prior authorization team."  
**Spanish:** "Tengo problemas para verificar eso ahora. Permítame conectarlo con nuestro equipo de autorización previa."

**Next:** SetNeedsTransfer

---

#### CompareProcedureFound
**Type:** Compare  
**Compares:** `$.External.found`

| Value | Next block |
|-------|------------|
| "true" | PersistPriorAuthResults |
| NoMatchingCondition | PriorAuthNotFoundLanguageCheck |

---

#### PersistPriorAuthResults
**Type:** UpdateContactAttributes

**Attributes set:**
| Attribute | Source |
|-----------|--------|
| `externalCovered` | `$.External.covered` |
| `externalRequiresPriorAuth` | `$.External.requiresPriorAuth` |
| `externalDescription` | `$.External.description` |

**Next:** CompareProcedureCovered

---

#### PriorAuthNotFoundLanguageCheck → PriorAuthCodeNotFound[En\|Es]

**English:** "I wasn't able to find information for that procedure code. Let me connect you with someone who can help."  
**Spanish:** "No pude encontrar información para ese código de procedimiento. Permítame conectarlo con alguien que pueda ayudarle."

**Next:** SetNeedsTransfer

---

#### CompareProcedureCovered
**Type:** Compare  
**Compares:** `$.External.covered`

| Value | Next block |
|-------|------------|
| "true" | CompareProcedurePriorAuth |
| NoMatchingCondition | ProcedureNotCoveredLanguageCheck |

---

#### ProcedureNotCoveredLanguageCheck → ProcedureNotCovered[En\|Es]

**English:** "That procedure isn't covered under your current plan. A representative can review your options, including the appeals process."  
**Spanish:** "Ese procedimiento no está cubierto bajo su plan actual. Un representante puede revisar sus opciones, incluido el proceso de apelación."

**Next:** SetNeedsTransfer

---

#### CompareProcedurePriorAuth
**Type:** Compare  
**Compares:** `$.External.requiresPriorAuth`

| Value | Next block |
|-------|------------|
| "true" | PriorAuthRequiredLanguageCheck |
| NoMatchingCondition | ProcedureCoveredNoPriorAuthLanguageCheck |

---

#### Prior auth outcome messages

**Prior auth required** — auto-transfer, no choice

| Language | Message |
|----------|---------|
| English | "Your plan covers this procedure, but prior authorization is required before your scheduled date. I'll connect you with our prior authorization team now." |
| Spanish | "Su plan cubre este procedimiento, pero se requiere autorización previa antes de su fecha programada. Ahora le conectaré con nuestro equipo de autorización previa." |

Next: SetNeedsTransfer (no offer-transfer prompt — callers pre-surgical need immediate routing)

**Covered, no prior auth required**

| Language | Message |
|----------|---------|
| English | "Good news — your plan covers this procedure and no prior authorization is required." |
| Spanish | "Buenas noticias: su plan cubre este procedimiento y no se requiere autorización previa." |

Next: OfferTransferPriorAuth[En\|Es]

---

#### OfferTransferPriorAuth[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "If you have any other questions, press 1 to speak with a representative. Press 2 to end the call."  
**Spanish:** "Si tiene alguna otra pregunta, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | EndModule ⚠️ silent drop |
| NoMatchingCondition | EndModule ⚠️ silent drop |

> **Known gap:** Same silent drop issue as ClaimsModule. Timeout and no-match should route to SetNeedsTransfer.

---

## EligibilityModule (`CONTACT_FLOW_MODULE`)

Eligibility self-service. Reads `$.Customer.Attributes.coverageStatus` from the ANI lookup — no Lambda invocation. Four outcomes, bilingual, offer-transfer pattern matching all other domain modules.

**No Lambda required** — coverage status is already in `$.Customer.*` from `LookupByPhone`.

### Block-by-block walkthrough

---

#### EligibilityLanguageCheck → CheckCoverageStatus[En\|Es]
**Type:** Compare → Compare

Branches on `preferredLanguage`, then on `$.Customer.Attributes.coverageStatus`.

| coverageStatus | English message | Disposition |
|---|---|---|
| ACTIVE | "Your coverage is currently active. You have full access to your benefits under your current plan." | OfferTransfer |
| SUSPENDED | "Your coverage is currently suspended. Please speak with a representative for assistance." | SetNeedsTransfer (auto-transfer) |
| PENDING | "Your coverage is currently pending. It may take a few business days to become active." | OfferTransfer |
| NoMatchingCondition | "We were unable to locate your eligibility information. Let me connect you with a representative." | SetNeedsTransfer (auto-transfer) |

| coverageStatus | Spanish message | Disposition |
|---|---|---|
| ACTIVE | "Su cobertura está actualmente activa. Tiene acceso completo a sus beneficios bajo su plan actual." | OfferTransfer |
| SUSPENDED | "Su cobertura está actualmente suspendida. Por favor hable con un representante para obtener ayuda." | SetNeedsTransfer (auto-transfer) |
| PENDING | "Su cobertura está actualmente pendiente. Puede tardar algunos días hábiles en activarse." | OfferTransfer |
| NoMatchingCondition | "No pudimos encontrar su información de elegibilidad. Permítame conectarlo con un representante." | SetNeedsTransfer (auto-transfer) |

SUSPENDED and unknown auto-transfer — no choice offered. ACTIVE and PENDING callers get OfferTransfer.

---

#### OfferTransferEligibility[En\|Es]
**Type:** GetParticipantInput  
**Input timeout:** 8 seconds

**English:** "If you have additional questions, press 1 to speak with a representative. Press 2 to end the call."  
**Spanish:** "Si tiene preguntas adicionales, oprima 1 para hablar con un representante. Oprima 2 para terminar la llamada."

| Input | Next block |
|-------|------------|
| 1 | SetNeedsTransfer |
| 2 | EndModule |
| InputTimeLimitExceeded | SetNeedsTransfer |
| NoMatchingCondition | SetNeedsTransfer |

---

#### SetNeedsTransfer → EndModule

Sets `needsTransfer=true`, returns to `CheckNeedsTransfer` in MainInbound.

---

## Contact Attributes Reference

All attributes set during a call, available to agents at answer time.

### Set by MainInbound

| Attribute | Set by | Values |
|-----------|--------|--------|
| `preferredLanguage` | SetEnglishAttr / SetSpanishAttr | `"en"` / `"es"` |
| `callReason` | SetIntent* blocks | See table below |
| `slotClaimNumber` | SetIntentClaims | From `$.Lex.Slots.ClaimNumber` |
| `slotDateOfService` | SetIntentClaims | From `$.Lex.Slots.DateOfService` |
| `slotServiceType` | SetIntentBenefits | From `$.Lex.Slots.ServiceType` |
| `slotProcedureCode` | SetIntentPriorAuth | From `$.Lex.Slots.ProcedureCode` |
| `slotProviderName` | SetIntentPriorAuth / SetIntentProviderLookup | From `$.Lex.Slots.ProviderName` |
| `slotSpecialty` | SetIntentProviderLookup | From `$.Lex.Slots.Specialty` |
| `slotZipCode` | SetIntentProviderLookup | From `$.Lex.Slots.ZipCode` |
| `slotMedicationName` | SetIntentPrescription | From `$.Lex.Slots.MedicationName` |
| `slotMemberId` | SetIntentEligibility | From `$.Lex.Slots.MemberId` |
| `slotInvoiceNumber` | SetIntentBilling | From `$.Lex.Slots.InvoiceNumber` |
| `needsTransfer` | Set by modules | `"true"` when agent needed |
| `callerIdentified` | SetCallerIdentified (on ANI success) | `"true"` when profile found |
| `callerName` | SetCallerName / SetCallerNameUnknown | First + last name or `"Unidentified Member"` |

**callReason values by intent:**

| Intent | callReason value |
|--------|-----------------|
| ClaimsStatusIntent | `claims_status` |
| BenefitsInquiryIntent | `benefits_inquiry` |
| PriorAuthorizationIntent | `prior_authorization` |
| ProviderLookupIntent | `provider_lookup` |
| PrescriptionIntent | `prescription` |
| EligibilityIntent | `eligibility` |
| BillingIntent | `billing` |

### Set by ANI lookup (Customer Profiles → `$.Customer.*`)

These are not contact attributes — they live in the Connect system namespace and are read via `$.Customer.*` JSONPath throughout the flows and modules.

| Path | Description |
|------|-------------|
| `$.Customer.FirstName` | Caller first name |
| `$.Customer.LastName` | Caller last name |
| `$.Customer.Attributes.memberId` | Health plan member ID |
| `$.Customer.Attributes.planId` | Plan identifier |
| `$.Customer.Attributes.coverageStatus` | `ACTIVE` / `SUSPENDED` / `PENDING` |

### Set by domain modules (Lambda results)

| Attribute | Set by | Lambda field |
|-----------|--------|--------------|
| `externalStatus` | ClaimsModule, BillingModule | `$.External.status` |
| `externalDateOfService` | ClaimsModule | `$.External.dateOfService` |
| `externalBilledAmount` | ClaimsModule | `$.External.billedAmount` |
| `externalPaidAmount` | ClaimsModule | `$.External.paidAmount` |
| `externalDenialReason` | ClaimsModule | `$.External.denialReason` |
| `externalAmount` | BillingModule | `$.External.amount` |
| `externalDateIssued` | BillingModule | `$.External.dateIssued` |
| `externalDueDate` | BillingModule | `$.External.dueDate` |
| `externalDescription` | BillingModule, PriorAuthModule | `$.External.description` |
| `externalMedicationName` | FormularyModule | `$.External.medicationName` |
| `externalCovered` | FormularyModule, PriorAuthModule | `$.External.covered` |
| `externalTier` | FormularyModule | `$.External.tier` |
| `externalCopay` | FormularyModule | `$.External.copay` |
| `externalRequiresPriorAuth` | FormularyModule, PriorAuthModule | `$.External.requiresPriorAuth` |
| `externalName` | ProviderModule | `$.External.name` |
| `externalPhone` | ProviderModule | `$.External.phone` |
| `externalInNetwork` | ProviderModule | `$.External.inNetwork` |

---

## Design Decisions

**Fail-open on Lambda errors.** Every Lambda invocation has an error branch that routes to agent transfer rather than disconnect. Callers are never stranded by a backend failure.

**Auto-transfer for high-stakes outcomes.** OVERDUE invoices, SUSPENDED coverage, and prior auth required all skip the "press 1 to transfer" prompt and route directly to an agent. Offering a caller with a past-due balance the option to hang up is the wrong message.

**Bridge messages before Lambda calls.** Each module plays a "one moment" message before invoking its Lambda. This fills the cold-start silence (~1–2 seconds) and prevents callers from interpreting silence as a dropped call.

**Persist before route.** Lambda results (`$.External.*`) are saved as contact attributes immediately after a successful lookup, before any branching or routing. This means the attributes are present regardless of which outcome branch executes and regardless of whether the caller is transferred.

**Language branching pattern.** Every bilingual fork is a `Compare` on `$.Attributes.preferredLanguage` with `when(equalsCondition("es"), ...)` and `onError(..., "NoMatchingCondition")` defaulting to English. This pattern repeats throughout all flows and modules.

**Voice re-set in queue flow.** TTS voice settings do not carry over from the inbound flow into the queue flow. `SupportQueueExperience` re-establishes Joanna or Lupe Neural as its first action.

**Modules communicate via contact attributes.** `InvokeFlowModule` has no direct return value mechanism — modules signal outcomes by setting `needsTransfer=true` as a contact attribute before `EndFlowModuleExecution`. The parent checks this attribute at `CheckNeedsTransfer`.

**Per-intent queue routing.** `RouteToQueue` reads `callReason` and fans out to 5 domain queues (claims, billing, pharmacy, provider, member-services), each with its own `SetCustomerQueueFlow` + `SetWorkingQueue` pair before a single shared `TransferToQueue`. All unrecognized paths — benefits, eligibility auto-transfers, intent timeout, module errors — fall through to member-services via `NoMatchingCondition`. Pharmacy absorbs both `prescription` and `prior_authorization` since both are handled by the same specialist team.

**SupportQueueExperience is kept but not routed.** The original generic queue flow remains deployed as an inert fallback. Nothing in the current flow sets it as the customer queue flow. It can be re-wired quickly if needed.
