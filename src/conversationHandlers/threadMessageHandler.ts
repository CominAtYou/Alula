import { Message } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import splitMessage from "../util/splitMessage";
import { ANONYMOUS_COMMAND_PREFIX } from "../constants";

export default async function handleThreadMessage(message: Message) {
    const db = getMongoDatabase();
    const activeThread = await db.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: message.channel.id });

    if (!activeThread) {
        return;
    }

    const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
    const leftoverFiles = [...message.attachments.values()].filter(attachment => attachment.size > 25000000);

    let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");
    if (leftoverFiles.length > 0) {
        messageContent += '\n';

        leftoverFiles.forEach(attachment => {
            messageContent += `\n${attachment.url}`;
        });
    }

    let isCurrentMessageAnonymous = activeThread.areModeratorsHidden;

    if (messageContent.startsWith(`${ANONYMOUS_COMMAND_PREFIX}identity `)) {
        messageContent = messageContent.replace(`${ANONYMOUS_COMMAND_PREFIX}identity `, "");
        isCurrentMessageAnonymous = !isCurrentMessageAnonymous;
    }

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();
    const messageContentSplit = splitMessage(messageContent);

    const anonymousMessageIds: string[] = [];
    for (let i = 0; i < messageContentSplit.length; i++) {
        const newMessage = await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContentSplit[i],
            files: i === messageContentSplit.length - 1 ? files : []
        });

        if (isCurrentMessageAnonymous) {
            anonymousMessageIds.push(newMessage.id);
        }
    }

    if (messageContentSplit.length === 0) {
        const newMessage = await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContent,
            files: files
        });

        if (isCurrentMessageAnonymous) {
            anonymousMessageIds.push(newMessage.id);
        }
    }

    if (anonymousMessageIds.length > 0) {
        await db.collection<ActiveThread>("active_threads").updateOne({ receivingThreadId: message.channel.id }, { $push: { anonymousMessages: { $each: anonymousMessageIds } } });
    }
}
