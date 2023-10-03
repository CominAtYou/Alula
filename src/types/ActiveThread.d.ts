import { ThreadType } from "./ThreadType";

export default interface ActiveThread {
    userId: string;
    receivingThreadId: string;
    type: ThreadType;
    areModeratorsHidden: boolean;
    webhookMessageMap: { webhookMessageId: string, originalMessageId: string }[]
    anonymousMessages: string[]
}
