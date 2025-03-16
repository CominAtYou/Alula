import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, EmbedBuilder, Message, MessageType, TextChannel, ThreadChannel, User } from "discord.js";
import { MODERATION_MODMAIL_LOG_CHANNEL_ID, APPEALS_MODMAIL_LOG_CHANNEL_ID, DATA_MODMAIL_LOG_CHANNEL_ID, DEBUG_LOG_CHANNEL_ID } from "../constants";
import { mongoDatabase } from "../db/mongoInstance";
import { ThreadType } from "../types/ThreadType";
import ActiveThread from "../types/ActiveThread";
import ConversationDetails from "../types/ConversationDetails";
import isModeratorCompletelyAnonymous from "../util/anonymousChecks";
import generateTranscript from "../transcript/newTranscriptGenerator";
import Analytics from "../types/Analytics";

export default async function closeThread(client: Client, channelId: string, invoker: User) {
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: channelId });
    const thread = await client.channels.fetch(channelId) as ThreadChannel;
    const closedDueToInactivity = invoker.id === client.user!.id;

    if (!activeThread) return;

    const user = await client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();

    const threadDetails: ConversationDetails = {
        type: activeThread.type,
        threadId: thread.id,
        opened: thread.createdAt!,
        guild: thread.guild,
        closed: new Date(),
        closerUsername: invoker.username,
        closerId: invoker.id,
        creator: user
    }

    const threadMessages: Message[] = [];
    let lastMessageId: string | undefined = undefined;
    let lastNumberOfRetrievedMessages = 0;

    do {
        const messages: Collection<string, Message<true>> = await thread.messages.fetch({ limit: 100, before: lastMessageId });
        lastNumberOfRetrievedMessages = messages.size;
        lastMessageId = messages.last()!.id;
        threadMessages.push(...messages.filter(message => message.type === MessageType.Default && (!message.author.bot || message.webhookId)).values());
    }
    while (lastNumberOfRetrievedMessages === 100);

    threadMessages.reverse();

    const attendingModerators = thread.guildMembers.filter(member => !member.user.bot);
    const moderatorTranscript = await generateTranscript(threadDetails, threadMessages, attendingModerators, false);

    if (activeThread.anonymousMessages.length > 0) {
        var userTranscript = await generateTranscript(threadDetails, threadMessages, attendingModerators, true);
    }

    const modTranscript = [new AttachmentBuilder(Buffer.from(moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}.html`)];

    await thread.send({
        content: closedDueToInactivity ? "This thread was closed due to inactivity." : `@${invoker.username} closed this thread.`,
        files: modTranscript
    });

    await thread.setLocked(true);
    await thread.setArchived(true);
    const isCloserAnonymous = isModeratorCompletelyAnonymous(invoker.id, threadMessages, activeThread.anonymousMessages);

    try {
        await userDMChannel.send({
            content: closedDueToInactivity ? "Your thread was closed due to inactivity. Send another message to open a new thread." : `Your thread was closed by ${isCloserAnonymous ? "a moderator" : `@${invoker.username}`}. Send another message to open a new thread.`,
            files: [new AttachmentBuilder(Buffer.from(activeThread.anonymousMessages.length > 0 ? userTranscript! : moderatorTranscript)).setName(`transcript-${user.username}-${thread.id}${activeThread.anonymousMessages.length > 0 ? "-ab" : ""}.html`)]
        });
    }
    catch { /* empty */ }

    let membersInThread = "";
    thread.guildMembers.forEach(member => {
        if (!member.user.bot) {
            membersInThread += `<@${member.id}> - @${member.user.username}\n`;
        }
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

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(thread.url)
                .setLabel("View Thread")
        );


    const LOG_CHANNEL_ID = activeThread.type === ThreadType.MODERATION ? MODERATION_MODMAIL_LOG_CHANNEL_ID : (activeThread.type === ThreadType.APPEAL ? APPEALS_MODMAIL_LOG_CHANNEL_ID : DATA_MODMAIL_LOG_CHANNEL_ID);
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
    await logChannel.send({ embeds: [embed], files: modTranscript, components: [buttonRow] });

    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
    await mongoDatabase.collection<Analytics>("analytics").updateOne({ guild: thread.guild.id }, { $inc: { closedThreads: 1 } }, { upsert: true });

    if (closedDueToInactivity) {
        const debugLogChannel = await client.channels.fetch(DEBUG_LOG_CHANNEL_ID) as TextChannel;
        await debugLogChannel.send(`Thread ${thread.id} (opened by @${user.username} [${user.id}]) was closed due to inactivity.`);
    }
}
