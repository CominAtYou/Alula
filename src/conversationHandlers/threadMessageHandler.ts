import { Message } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import splitMessage from "../util/splitMessage";
import { ATTACHMENT_RETREIVAL_DOMAIN } from "../constants";

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

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();
    const messageContentSplit = splitMessage(messageContent);

    for (let i = 0; i < messageContentSplit.length; i++) {
        userDMChannel.send({
            content: (activeThread.areModeratorsHidden ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContentSplit[i],
            files: i === messageContentSplit.length - 1 ? files : []
        });
    }

    if (messageContentSplit.length === 0) {
        userDMChannel.send({
            content: (activeThread.areModeratorsHidden ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContent,
            files: files
        });
    }
}
