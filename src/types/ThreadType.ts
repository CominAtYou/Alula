import { APPEALS_FORUM_CHANNEL_ID, DATA_FORUM_CHANNEL_ID, MODERATION_FORUM_CHANNEL_ID } from "../constants";

export enum ThreadType {
    MODERATION = "moderation",
    APPEAL = "appeals",
    DATA = "data"
}

export const threadIds = {
    [ThreadType.MODERATION]: MODERATION_FORUM_CHANNEL_ID,
    [ThreadType.APPEAL]: APPEALS_FORUM_CHANNEL_ID,
    [ThreadType.DATA]: DATA_FORUM_CHANNEL_ID
}
