import { DisconnectParticipantActionBuilder, FlowBuilder, MessageParticipantActionBuilder, SetCustomerQueueFlowActionBuilder, TransferContactToQueueActionBuilder, UpdateContactTargetQueueActionBuilder, } from "connect-flow-builder";
export const mainInboundSpec = {
    key: "mainInbound",
    name: "MainInbound",
    type: "CONTACT_FLOW",
    filename: "main-inbound.json",
    description: "Primary inbound flow for support.",
    dependsOnFlows: ["supportQueueExperience"],
    build: (context) => {
        const greeting = new MessageParticipantActionBuilder("Greeting")
            .text("Welcome to Mini Connect.")
            .next("SetSupportQueueFlow")
            .build();
        const setSupportQueueFlow = new SetCustomerQueueFlowActionBuilder("SetSupportQueueFlow")
            .customerQueueFlowArn(context.refs.flowArn("supportQueueExperience"))
            .next("SetWorkingQueue")
            .onError("Disconnect")
            .build();
        const setWorkingQueue = new UpdateContactTargetQueueActionBuilder("SetWorkingQueue")
            .queueId(context.refs.queueArn("support"))
            .next("TransferToSupport")
            .onError("Disconnect")
            .build();
        const transfer = new TransferContactToQueueActionBuilder("TransferToSupport")
            .next("Disconnect")
            .onError("Disconnect", "QueueAtCapacity")
            .onError("Disconnect")
            .build();
        const disconnect = new DisconnectParticipantActionBuilder("Disconnect").build();
        return new FlowBuilder("MainInbound")
            .startWith(greeting)
            .add(setSupportQueueFlow)
            .add(setWorkingQueue)
            .add(transfer)
            .add(disconnect)
            .build();
    },
};
