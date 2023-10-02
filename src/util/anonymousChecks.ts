import { Message } from "discord.js";

/**
 * Check whether or not all the messages sent by a moderator in a thread were anonymous.
 * @param moderatorId The ID of the moderator to check.
 * @param messages A list of messages sent in the current thread.
 * @param hiddenMessageIds A list of message IDs that were sent anonymously.
 * @returns boolean {@code true} if the moderator has only sent anonymous messages, {@code false} otherwise.
 */
export default function isModeratorCompletelyAnonymous(moderatorId: string, messages: Message[], hiddenMessageIds: string[]) {
    const moderatorMessages = messages.filter(message => message.author.id === moderatorId);
    return moderatorMessages.every(message => hiddenMessageIds.includes(message.id));
}
