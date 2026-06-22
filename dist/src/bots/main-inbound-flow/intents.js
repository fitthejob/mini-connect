export const intents = [
    {
        name: "EnglishIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: ["English", "one", "1"],
            },
            {
                localeId: "es_US",
                utterances: ["English", "uno", "1"],
            },
        ],
    },
    {
        name: "SpanishIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: ["Spanish", "Español", "two", "2"],
            },
            {
                localeId: "es_US",
                utterances: ["Español", "español", "dos", "2"],
            },
        ],
    },
    {
        name: "ClaimsStatusIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "Where is my claim",
                    "Has my claim been processed",
                    "What is the status of my claim",
                    "I want to check on my claim",
                    "My claim was denied",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "¿Dónde está mi reclamación?",
                    "¿Ha sido procesada mi reclamación?",
                    "¿Cuál es el estado de mi reclamación?",
                    "Quiero verificar mi reclamación",
                    "Mi reclamación fue rechazada",
                ],
            },
        ],
        slots: [
            {
                name: "ClaimNumber",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Required",
                prompts: [
                    { localeId: "en_US", value: "What is your claim number?" },
                    { localeId: "es_US", value: "¿Cuál es su número de reclamación?" },
                ],
            },
            {
                name: "DateOfService",
                slotTypeName: "AMAZON.Date",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "What was the date of service for your claim?" },
                    { localeId: "es_US", value: "¿Cuál fue la fecha de servicio de su reclamación?" },
                ],
            },
        ],
    },
    {
        name: "BenefitsInquiryIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "What does my plan cover",
                    "Am I covered for this procedure",
                    "What are my benefits",
                    "Does my plan include dental",
                    "What is included in my coverage",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "¿Qué cubre mi plan?",
                    "¿Estoy cubierto para este procedimiento?",
                    "¿Cuáles son mis beneficios?",
                    "¿Mi plan incluye dental?",
                    "¿Qué está incluido en mi cobertura?",
                ],
            },
        ],
        slots: [
            {
                name: "ServiceType",
                slotTypeName: "ServiceTypeSlotType",
                constraint: "Required",
                prompts: [
                    { localeId: "en_US", value: "What type of service are you inquiring about? For example, dental, vision, prescription, or medical." },
                    { localeId: "es_US", value: "¿Sobre qué tipo de servicio desea preguntar? Por ejemplo, dental, visión, receta o médico." },
                ],
            },
        ],
    },
    {
        name: "PriorAuthorizationIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "I need a prior authorization",
                    "My doctor needs an authorization",
                    "How do I get prior auth approved",
                    "My procedure needs to be authorized",
                    "Can you start a prior auth request",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "Necesito una autorización previa",
                    "Mi médico necesita una autorización",
                    "¿Cómo obtengo una autorización previa?",
                    "Mi procedimiento necesita ser autorizado",
                    "¿Puede iniciar una solicitud de autorización?",
                ],
            },
        ],
        slots: [
            {
                name: "ProcedureCode",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "Do you have a procedure code for the authorization request?" },
                    { localeId: "es_US", value: "¿Tiene un código de procedimiento para la solicitud de autorización?" },
                ],
            },
            {
                name: "ProviderName",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "What is the name of the provider requesting the authorization?" },
                    { localeId: "es_US", value: "¿Cuál es el nombre del proveedor que solicita la autorización?" },
                ],
            },
        ],
    },
    {
        name: "ProviderLookupIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "Find me a doctor",
                    "Is my doctor in network",
                    "I need to find a specialist",
                    "What doctors accept my plan",
                    "Help me find an in network provider",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "Busca un médico",
                    "¿Mi médico está en la red?",
                    "Necesito encontrar un especialista",
                    "¿Qué médicos aceptan mi plan?",
                    "Ayúdame a encontrar un proveedor en la red",
                ],
            },
        ],
        slots: [
            {
                name: "Specialty",
                slotTypeName: "MedicalSpecialtySlotType",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "What type of specialist are you looking for? For example, primary care, cardiology, or dermatology." },
                    { localeId: "es_US", value: "¿Qué tipo de especialista busca? Por ejemplo, médico general, cardiología o dermatología." },
                ],
            },
            {
                name: "ZipCode",
                slotTypeName: "AMAZON.Number",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "What is your zip code so I can find providers near you?" },
                    { localeId: "es_US", value: "¿Cuál es su código postal para encontrar proveedores cerca de usted?" },
                ],
            },
        ],
    },
    {
        name: "PrescriptionIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "I have a question about my medication",
                    "Is my prescription covered",
                    "I need help with a prescription",
                    "How do I get my medication covered",
                    "My prescription was denied",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "Tengo una pregunta sobre mi medicamento",
                    "¿Está cubierta mi receta?",
                    "Necesito ayuda con una receta",
                    "¿Cómo obtengo cobertura para mi medicamento?",
                    "Mi receta fue rechazada",
                ],
            },
        ],
        slots: [
            {
                name: "MedicationName",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Required",
                prompts: [
                    { localeId: "en_US", value: "What is the name of the medication you need help with?" },
                    { localeId: "es_US", value: "¿Cuál es el nombre del medicamento con el que necesita ayuda?" },
                ],
            },
        ],
    },
    {
        name: "EligibilityIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "Am I eligible for coverage",
                    "When does my coverage start",
                    "How do I know if I qualify",
                    "Check my eligibility",
                    "Is my coverage still active",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "¿Soy elegible para cobertura?",
                    "¿Cuándo comienza mi cobertura?",
                    "¿Cómo sé si califico?",
                    "Verificar mi elegibilidad",
                    "¿Mi cobertura sigue activa?",
                ],
            },
        ],
        slots: [
            {
                name: "MemberId",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Required",
                prompts: [
                    { localeId: "en_US", value: "What is your member ID?" },
                    { localeId: "es_US", value: "¿Cuál es su número de miembro?" },
                ],
            },
        ],
    },
    {
        name: "BillingIntent",
        utterances: [
            {
                localeId: "en_US",
                utterances: [
                    "I received a bill",
                    "Can you explain my explanation of benefits",
                    "I have a billing question",
                    "Why was I charged for this",
                    "I need help understanding my bill",
                ],
            },
            {
                localeId: "es_US",
                utterances: [
                    "Recibí una factura",
                    "¿Puede explicarme mi explicación de beneficios?",
                    "Tengo una pregunta de facturación",
                    "¿Por qué me cobraron esto?",
                    "Necesito ayuda para entender mi factura",
                ],
            },
        ],
        slots: [
            {
                name: "InvoiceNumber",
                slotTypeName: "AMAZON.AlphaNumeric",
                constraint: "Optional",
                prompts: [
                    { localeId: "en_US", value: "Do you have an invoice or bill number I can reference?" },
                    { localeId: "es_US", value: "¿Tiene un número de factura o recibo que pueda consultar?" },
                ],
            },
        ],
    },
    {
        name: "FallbackIntent",
        utterances: [],
    },
];
