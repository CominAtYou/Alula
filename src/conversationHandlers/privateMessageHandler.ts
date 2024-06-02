import { ActionRowBuilder, ForumChannel, Message, ButtonStyle, ButtonBuilder, ComponentType, EmbedBuilder, AllowedMentionsTypes, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, GuildMember, Guild, ThreadChannel } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import { MODERATION_FORUM_CHANNEL_ID, NEW_THREAD_NOTIFICATION_ROLE_ID, MODMAIL_BAN_ROLE_ID, TEXT_COMMAND_PREFIX } from "../constants";
import ActiveThread from "../types/ActiveThread";
import { ThreadType, threadIds } from "../types/ThreadType";
import splitMessage from "../util/splitMessage";
import GuildConfig from "../types/GuildConfig";
import Analytics from "../types/Analytics";

/**
 * A list of users who are currently in the process of selecting a thread type.
 * This exists to prevent the bot from sending multiple messages to the same user.
 */
const typeSelectionInProgressUsers: string[] = [];

async function createNewThread(message: Message, guildMember: GuildMember, guild: Guild) {
    const guildConfig = await mongoDatabase.collection<GuildConfig>("guildconfigs").findOne({ guildId: guild.id });
    if (guildConfig && guildConfig.modmailDisabled) {
        await message.channel.send("Modmail submissions aren't currently being accepted right now. Please try again later!");
        return;
    }

    const mailTypeMessage = await message.channel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("What type of request are you making?")
                .setDescription("Before you get started, please indicate the type of request you are making. Request types are listed below.")
                .setColor("#007acc")
                .addFields([
                    {
                        name: "Moderation",
                        value: "Used for moderation requests, such as reporting a player."
                    },
                    {
                        name: "Appeals",
                        value: "Anything involving contesting or appealing moderation actions, such as a ban from the game."
                    },
                    {
                        name: "Data",
                        value: "Anything regarding your stats."
                    }
                ])
        ],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('type_select_menu')
                    .setPlaceholder("Select a Request Type")
                    .addOptions([
                        new StringSelectMenuOptionBuilder()
                            .setLabel("Moderation")
                            .setValue("moderation")
                            .setDescription("Used for moderation requests, such as reporting a player."),
                        new StringSelectMenuOptionBuilder()
                            .setLabel("Appeals")
                            .setValue("appeals")
                            .setDescription("Anything involving contesting or appealing moderation actions."),
                        new StringSelectMenuOptionBuilder()
                            .setLabel("Data")
                            .setValue("data")
                            .setDescription("Anything regarding your stats.")
                    ])
            )
        ]
    });

    let response: StringSelectMenuInteraction = null;
    try {
        typeSelectionInProgressUsers.push(message.author.id);
        response = await mailTypeMessage.awaitMessageComponent<ComponentType.StringSelect>({ time: 60000 });
    }
    catch {
        await mailTypeMessage.edit({ content: "Your session has expired. Re-send your initial message to try again.", components: [], embeds: [] });
        typeSelectionInProgressUsers.splice(typeSelectionInProgressUsers.indexOf(message.author.id), 1);
        return;
    }

    await response.deferUpdate();
    const threadType = response.values[0] as ThreadType;
    const forumChannel = await message.client.channels.fetch(threadIds[threadType]) as ForumChannel;
    const forumChannelWebhooks = await forumChannel.fetchWebhooks();
    const webhook = forumChannelWebhooks.size > 0 ? forumChannelWebhooks.first() : await forumChannel.createWebhook({ name: "Modmail Webhook", reason: "No webhook was present for the forum channel." });

    typeSelectionInProgressUsers.splice(typeSelectionInProgressUsers.indexOf(message.author.id), 1);

    const newThread = await forumChannel.threads.create({
        name: `@${message.author.username}`,
        autoArchiveDuration: 1440,
        reason: "New modmail thread",
        message: {
            content: `${threadType !== ThreadType.APPEAL ? "<@&" + NEW_THREAD_NOTIFICATION_ROLE_ID + "> " : ""}<@${message.author.id}> (${message.author.id}) has started a new modmail thread.\nUse </anon:1158087318431867023> to hide or reveal the identity of moderators participating in this thread.\n\`${TEXT_COMMAND_PREFIX}identity\` can be used to selectively reveal your identity if the thread is set to anonymous, or to hide your identity otherwise.`,
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId("close_thread").setLabel("Close Thread").setStyle(ButtonStyle.Danger).setEmoji("🔒")
                )
            ]
        }
    });

    newThread.setName(`${newThread.name} [${newThread.id}]`);

    await mongoDatabase.collection<ActiveThread>("active_threads").insertOne({
        userId: message.author.id,
        receivingThreadId: newThread.id,
        type: threadType,
        areModeratorsHidden: true,
        webhookMessageMap: [],
        anonymousMessages: []
    });

    await mongoDatabase.collection<Analytics>("analytics").updateOne({ guild: guild.id }, { $inc: { openedThreads: 1 } }, { upsert: true });

    const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
    const leftoverFiles = message.attachments.filter(attachment => attachment.size > 25000000);

    let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");;
    if (leftoverFiles.size > 0) {
        messageContent += "\n";
        leftoverFiles.forEach(attachment => {
            messageContent += `\n${attachment.url}`;
        });
    }

    const messageContentSplit = splitMessage(messageContent);
    for (let i = 0; i < messageContentSplit.length; i++) {
        const result = await webhook.send({
            threadId: newThread.id,
            content: messageContentSplit[i],
            username: guildMember.displayName,
            avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
            files: i === messageContentSplit.length - 1 ? files : [],
            allowedMentions: { parse: [ AllowedMentionsTypes.User ] }
        });

        await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ userId: message.author.id }, { $push: { webhookMessageMap: { webhookMessageId: result.id, originalMessageId: message.id } } });
    }

    if (messageContentSplit.length === 0) {
        const result = await webhook.send({
            threadId: newThread.id,
            username: guildMember.displayName,
            avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
            files: files,
            allowedMentions: { parse: [ AllowedMentionsTypes.User ] }
        });

        await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ userId: message.author.id }, { $push: { webhookMessageMap: { webhookMessageId: result.id, originalMessageId: message.id } } });
    }

    mailTypeMessage.edit({
        content: "",
        embeds: [
            new EmbedBuilder()
                .setTitle("Message Sent!")
                .setColor("#007acc")
                .setDescription("A line has been opened to the staff team, and a staff member will respond momentarily. Anything you send in here will automatically be forwarded to them.")
                .addFields({ name: "Conversation ID", value: newThread.id, inline: true })
        ],
        components: []
    });
}

export default async function handlePrivateMessage(message: Message) {
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ userId: message.author.id });
    const guild = ((message.client.channels.cache.get(MODERATION_FORUM_CHANNEL_ID) ?? await message.client.channels.fetch(MODERATION_FORUM_CHANNEL_ID)) as ForumChannel).guild;
    const guildMember = await guild.members.fetch(message.author.id);

    if (guildMember.roles.cache.has(MODMAIL_BAN_ROLE_ID)) {
        message.channel.send("Your modmail priveliges have been revoked by a staff member. If you believe that this is a mistake, please contact a staff member via other means.");
        return;
    }

    if (typeSelectionInProgressUsers.includes(message.author.id)) return;

    if (activeThread) {
        const forumChannel = (message.client.channels.cache.get(threadIds[activeThread.type]) ?? await message.client.channels.fetch(threadIds[activeThread.type])) as ForumChannel;
        const threadChannel = (forumChannel.threads.cache.get(activeThread.receivingThreadId) ?? await forumChannel.threads.fetch(activeThread.receivingThreadId)) as ThreadChannel;

        if (threadChannel.archived) {
            await mongoDatabase.collection<ActiveThread>("active_threads").deleteMany({ userId: message.author.id });
            createNewThread(message, guildMember, guild);
            return;
        }

        const forumChannelWebhooks = await forumChannel.fetchWebhooks();
        const webhook = forumChannelWebhooks.size > 0 ? forumChannelWebhooks.first() : await forumChannel.createWebhook({ name: "Modmail Webhook", reason: "No webhook was present for the forum channel." });

        const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
        const leftoverFiles = message.attachments.filter(attachment => attachment.size > 25000000);

        let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");
        if (leftoverFiles.size > 0) {
            messageContent += `\n`;
            leftoverFiles.forEach(attachment => {
                messageContent += `\n${attachment.url}`;
            });
        }

        const messageContentSplit = splitMessage(messageContent);
        for (let i = 0; i < messageContentSplit.length; i++) {
            const result = await webhook.send({
                threadId: activeThread.receivingThreadId,
                content: messageContentSplit[i],
                username: guildMember.displayName,
                avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
                files: i === messageContentSplit.length - 1 ? files : [],
                allowedMentions: { parse: [ AllowedMentionsTypes.User ] }
            });

            await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ userId: message.author.id }, { $push: { webhookMessageMap: { webhookMessageId: result.id, originalMessageId: message.id } } });
        }

        if (messageContentSplit.length === 0) {
            const result = await webhook.send({
                threadId: activeThread.receivingThreadId,
                username: guildMember.displayName,
                avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
                files: files,
                allowedMentions: { parse: [ AllowedMentionsTypes.User ] }
            });

            await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ userId: message.author.id }, { $push: { webhookMessageMap: { webhookMessageId: result.id, originalMessageId: message.id } } });
        }
    }
    else {
        createNewThread(message, guildMember, guild);
    }
}
