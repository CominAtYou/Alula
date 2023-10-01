import { AttachmentBuilder, ButtonInteraction, EmbedBuilder, TextChannel, ThreadChannel } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import generateTranscript from "../transcript/newTranscriptGenerator";
import ConversationDetails from "../types/ConversationDetails";
import { MODMAIL_LOG_CHANNEL_ID } from "../constants";

export default async function closeThreadButtonHandler(interaction: ButtonInteraction) {
    const message = interaction.message;
    const db = getMongoDatabase();
    const activeThread = await db.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: interaction.channelId });
    const thread = await interaction.client.channels.fetch(interaction.channelId) as ThreadChannel;

    if (!activeThread) return;

    interaction.deferUpdate();

    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();

    const threadDetails: ConversationDetails = {
        type: activeThread.type,
        threadId: thread.id,
        opened: thread.createdAt,
        guild: thread.guild,
        closed: new Date(),
        closerUsername: interaction.user.username,
        closerId: interaction.user.id,
        creator: user
    }

    const threadMessages = Array.from((await thread.messages.fetch()).values()).reverse();

    const moderatorTranscript = await generateTranscript(threadDetails, threadMessages, thread.guildMembers.filter(member => !member.user.bot), false);
    if (activeThread.areModeratorsHidden) {
        var userTranscript = await generateTranscript(threadDetails, threadMessages, thread.guildMembers.filter(member => !member.user.bot), true);
    }

    const modTranscript = [new AttachmentBuilder(Buffer.from(moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}.html`)];

    await thread.send({
        content: `@${interaction.user.username} closed this thread.`,
        files: modTranscript
    });

    await thread.setArchived(true);

    await userDMChannel.send({
        content: `Your thread has been closed by ${activeThread.areModeratorsHidden ? "a moderator" : `@${interaction.user.username}`}. Send another message to open a new thread.`,
        files: [new AttachmentBuilder(Buffer.from(activeThread.areModeratorsHidden ? userTranscript : moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}-${activeThread.areModeratorsHidden ? "_ab" : ""}.html`)]
    });

    let membersInThread = "";
    thread.guildMembers.forEach(member => {
        if (member.user.bot) return;
        membersInThread += `<@${member.id}> - @${member.user.username}\n`
    });

    membersInThread += `<@${user.id}> - @${user.username}`;

    const embed = new EmbedBuilder()
        .setTitle("Thread Closed")
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ extension: 'png', forceStatic: true }) })
        .setColor("#007acc")
        .setFields([
            {
                name: "Ticket Owner",
                value: "<@" + user.id + ">",
                inline: true
            },
            {
                name: "Ticket Name",
                value: thread.name,
                inline: true
            },
            {
                name: "Users in Conversation",
                value: membersInThread,
                inline: true
            }
        ]);

    const logChannel = await interaction.client.channels.fetch(MODMAIL_LOG_CHANNEL_ID) as TextChannel;
    await logChannel.send({ embeds: [embed], files: modTranscript });

    await db.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
}
