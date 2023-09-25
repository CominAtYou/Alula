import { Message } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";

export default async function handleThreadMessage(message: Message) {
    const db = getMongoDatabase();
    const activeThread = await db.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: message.channel.id });

    if (!activeThread) {
        return;
    }

    const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
    const leftoverFiles = [...message.attachments.values()].filter(attachment => attachment.size > 25000000);

    let messageContent = message.content;
    if (leftoverFiles.length > 0) {
        messageContent += `\n\n${leftoverFiles.map(attachment => attachment.url).join("\n")}`;
    }

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();
    userDMChannel.send({
        content: (activeThread.areModeratorsHidden ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContent,
        files: files
    });
}
