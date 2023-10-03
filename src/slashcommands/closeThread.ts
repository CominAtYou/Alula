import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, Message, MessageType, TextChannel, ThreadChannel } from "discord.js";
import { MODERATION_MODMAIL_LOG_CHANNEL_ID, APPEALS_MODMAIL_LOG_CHANNEL_ID, DATA_MODMAIL_LOG_CHANNEL_ID } from "../constants";
import { mongoDatabase } from "../db/mongoInstance";
import { ThreadType } from "../types/ThreadType";
import ActiveThread from "../types/ActiveThread";
import ConversationDetails from "../types/ConversationDetails";
import isModeratorCompletelyAnonymous from "../util/anonymousChecks";
import generateTranscript from "../transcript/newTranscriptGenerator";

export default async function closeThread(interaction: ChatInputCommandInteraction) {
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: interaction.channelId });
    const thread = await interaction.client.channels.fetch(interaction.channelId) as ThreadChannel;

    if (!activeThread) return;

    const user = await interaction.client.users.fetch(activeThread.userId);
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

    const threadMessages: Message[] = [];
    let lastMessageId: string = undefined;
    let lastNumberOfRetrievedMessages = 0;

    do {
        const messages = await thread.messages.fetch({ limit: 100, before: lastMessageId });
        lastNumberOfRetrievedMessages = messages.size;
        lastMessageId = messages.last().id;
        threadMessages.push(...messages.filter(message => message.type === MessageType.Default && (!message.author.bot || message.webhookId)).values());
    }
    while (lastNumberOfRetrievedMessages == 100);

    threadMessages.reverse();

    const attendingModerators = thread.guildMembers.filter(member => !member.user.bot);

    const moderatorTranscript = await generateTranscript(threadDetails, threadMessages, attendingModerators, false);
    if (activeThread.anonymousMessages.length > 0) {
        var userTranscript = await generateTranscript(threadDetails, threadMessages, attendingModerators, true);
    }

    const modTranscript = [new AttachmentBuilder(Buffer.from(moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}.html`)];

    await thread.send({
        content: `@${interaction.user.username} closed this thread.`,
        files: modTranscript
    });

    await thread.setLocked(true);
    await thread.setArchived(true);
    const isCloserAnonymous = isModeratorCompletelyAnonymous(interaction.user.id, threadMessages, activeThread.anonymousMessages);

    await userDMChannel.send({
        content: `Your thread has been closed by ${isCloserAnonymous ? "a moderator" : `@${interaction.user.username}`}. Send another message to open a new thread.`,
        files: [new AttachmentBuilder(Buffer.from(activeThread.anonymousMessages.length > 0 ? userTranscript : moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}-${activeThread.anonymousMessages.length > 0 ? "ab" : ""}.html`)]
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


    const LOG_CHANNEL_ID = activeThread.type == ThreadType.MODERATION ? MODERATION_MODMAIL_LOG_CHANNEL_ID : (activeThread.type == ThreadType.APPEAL ? APPEALS_MODMAIL_LOG_CHANNEL_ID : DATA_MODMAIL_LOG_CHANNEL_ID);
    const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
    await logChannel.send({ embeds: [embed], files: modTranscript });

    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
}