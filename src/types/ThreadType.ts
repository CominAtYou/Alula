import { APPEALS_FORUM_CHANNEL_ID, DATA_FORUM_CHANNEL_ID, MODERATION_FORUM_CHANNEL_ID } from "../constants";

export enum ThreadType {
    MODERATION,
    APPEAL,
    DATA
}

export const stringToThreadType = {
    "moderation": ThreadType.MODERATION,
    "appeal": ThreadType.APPEAL,
    "data": ThreadType.DATA
}

export const threadTypeToId = {
    [ThreadType.MODERATION]: MODERATION_FORUM_CHANNEL_ID,
    [ThreadType.APPEAL]: APPEALS_FORUM_CHANNEL_ID,
    [ThreadType.DATA]: DATA_FORUM_CHANNEL_ID
}
