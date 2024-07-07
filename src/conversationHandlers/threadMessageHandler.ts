import { Message } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";
import splitMessage from "../util/splitMessage";
import { TEXT_COMMAND_PREFIX } from "../constants";

export default async function handleThreadMessage(message: Message) {
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: message.channel.id });

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

    if (messageContent.startsWith(`${TEXT_COMMAND_PREFIX}identity `)) {
        messageContent = messageContent.replace(`${TEXT_COMMAND_PREFIX}identity `, "");
        isCurrentMessageAnonymous = !isCurrentMessageAnonymous;
    }

    if (isCurrentMessageAnonymous) {
        await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ receivingThreadId: message.channel.id }, { $push: { anonymousMessages: message.id } });
    }

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();
    const messageContentSplit = splitMessage(messageContent);


    for (let i = 0; i < messageContentSplit.length; i++) {
        await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContentSplit[i],
            files: i === messageContentSplit.length - 1 ? files : []
        });
    }

    if (messageContentSplit.length === 0) {
        await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContent,
            files: files
        });
    }
}
