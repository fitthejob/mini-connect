import { BaseActionBuilder } from "../common.js";
export const MEDIA_STREAMING_STATES = [
    "Enabled",
    "Disabled",
];
export const MEDIA_DIRECTIONS = [
    "From",
    "To",
];
export class UpdateContactMediaStreamingBehaviorActionBuilder extends BaseActionBuilder {
    constructor(id) {
        super(id, "UpdateContactMediaStreamingBehavior");
        this.setParameter("Participants", []);
        this.setParameter("MediaStreamType", "Audio");
    }
    enabled() {
        return this.setParameter("MediaStreamingState", "Enabled");
    }
    disabled() {
        return this.setParameter("MediaStreamingState", "Disabled");
    }
    state(value) {
        return this.setParameter("MediaStreamingState", value);
    }
    participantCustomer(...directions) {
        const participants = this.getParameter("Participants");
        participants.push({
            ParticipantType: "Customer",
            MediaDirections: directions,
        });
        return this;
    }
    audioStream() {
        return this.setParameter("MediaStreamType", "Audio");
    }
}
