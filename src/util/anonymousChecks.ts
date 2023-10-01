import { Message } from "discord.js";

export default function isModeratorCompletelyAnonymous(moderatorId: string, messages: Message[], hiddenMessageIds: string[]) {
    const moderatorMessages = messages.filter(message => message.author.id === moderatorId);
    return moderatorMessages.every(message => hiddenMessageIds.includes(message.id));
}
