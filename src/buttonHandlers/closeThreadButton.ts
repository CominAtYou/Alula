import { AttachmentBuilder, ButtonInteraction, ThreadChannel } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import generateTranscript from "../transcript/newTranscriptGenerator";
import ConversationDetails from "../types/ConversationDetails";

export default async function closeThreadButtonHandler(interaction: ButtonInteraction) {
    const message = interaction.message;
    const thread = message.channel as ThreadChannel;
    const db = getMongoDatabase();
    const activeThread = await db.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: thread.id });

    if (!activeThread) return;

    interaction.deferUpdate();

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();

    const threadDetails: ConversationDetails = {
        type: activeThread.type,
        threadId: thread.id,
        opened: thread.createdAt,
        closed: new Date(),
        closerUsername: interaction.user.username,
        creator: user
    }

    const moderatorTranscript = await generateTranscript(threadDetails, Array.from(thread.messages.cache.values()), Array.from(thread.guildMembers.values()).filter(member => !member.user.bot), false);
    if (activeThread.areModeratorsHidden) {
        var userTranscript = await generateTranscript(threadDetails, Array.from(thread.messages.cache.values()), Array.from(thread.guildMembers.values()).filter(member => !member.user.bot), true);
    }

    await thread.send({
        content: `@${interaction.user.username} closed this thread.`,
        files: [new AttachmentBuilder(Buffer.from(moderatorTranscript)).setName("transcript.html")]
    });

    await thread.setArchived(true);

    await userDMChannel.send({
        content: `Your thread has been closed by ${activeThread.areModeratorsHidden ? "a moderator" : `@${interaction.user.username}`}. Send another message to open a new thread.`,
        files: [new AttachmentBuilder(Buffer.from(activeThread.areModeratorsHidden ? userTranscript : moderatorTranscript)).setName("transcript.html")]
    });

    await db.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
}
