import { DisconnectParticipantActionBuilder, FlowBuilder, MessageParticipantActionBuilder, } from "connect-flow-builder";
export const supportQueueExperienceSpec = {
    key: "supportQueueExperience",
    name: "SupportQueueExperience",
    type: "CUSTOMER_QUEUE",
    filename: "support-queue-experience.json",
    description: "Customer queue flow for the support queue experience.",
    build: () => {
        const queuedPrompt = new MessageParticipantActionBuilder("QueuedPrompt")
            .text("Please hold while we connect you to the next available agent.")
            .next("Disconnect")
            .build();
        const disconnect = new DisconnectParticipantActionBuilder("Disconnect").build();
        return new FlowBuilder("SupportQueueExperience")
            .startWith(queuedPrompt)
            .add(disconnect)
            .build();
    },
};
