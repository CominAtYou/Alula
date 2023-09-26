import { ActionRowBuilder, ForumChannel, Message, ButtonStyle, ButtonBuilder, ComponentType, ButtonInteraction, EmbedBuilder } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { MODERATION_FORUM_CHANNEL_ID, NEW_THREAD_NOTIFICATION_ROLE_ID, MODMAIL_BAN_ROLE_ID } from "../constants";
import { ActiveThread } from "../types/ActiveThread";
import { ThreadType, stringToThreadType, threadTypeToId } from "../types/ThreadType";
import splitMessage from "../util/splitMessage";

export default async function handlePrivateMessage(message: Message) {
    const db = getMongoDatabase();
    const activeThread = await db.collection<ActiveThread>("active_threads").findOne({ userId: message.author.id });
    const server = (await message.client.channels.fetch(MODERATION_FORUM_CHANNEL_ID) as ForumChannel).guild;
    const guildMember = await server.members.fetch(message.author.id);

    if (guildMember.roles.cache.has(MODMAIL_BAN_ROLE_ID)) {
        message.channel.send("Your modmail priveliges have been revoked by a staff member. If you believe that this is a mistake, please contact a staff member via other means.");
        return;
    }

    if (activeThread) {
        const forumChannel = await message.client.channels.fetch(threadTypeToId[activeThread.type]) as ForumChannel;
        const forumChannelWebhooks = await forumChannel.fetchWebhooks();
        const webhook = forumChannelWebhooks.size > 0 ? forumChannelWebhooks.first() : await forumChannel.createWebhook({ name: "Modmail Webhook", reason: "No webhook was present for the forum channel." });

        const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
        const leftoverFiles = [...message.attachments.values()].filter(attachment => attachment.size > 25000000).map(attachment => attachment.url);

        let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");;
        if (leftoverFiles.length > 0) {
            messageContent += `\n\n${leftoverFiles.join("\n")}`;
        }

        const messageContentSplit = splitMessage(messageContent);
        for (let i = 0; i < messageContentSplit.length; i++) {
            webhook.send({
                threadId: activeThread.receivingThreadId,
                content: messageContentSplit[i],
                username: guildMember.displayName,
                avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
                files: i === messageContentSplit.length - 1 ? files : []
            });
        }

        if (messageContentSplit.length === 0) {
            webhook.send({
                threadId: activeThread.receivingThreadId,
                username: guildMember.displayName,
                avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
                files: files
            });
        }

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
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId("moderation").setLabel("Moderation").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("appeal").setLabel("Appeals").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("data").setLabel("Data").setStyle(ButtonStyle.Secondary)
            )
        ]
    });

    let response: ButtonInteraction = null;
    try {
        response = await mailTypeMessage.awaitMessageComponent<ComponentType.Button>({ time: 60000 });
    }
    catch {
        mailTypeMessage.edit({ content: "Your session has expired. Re-send your initial message to try again.", components: [] });
        return;
    }

    await response.deferUpdate();
    const threadType: ThreadType = stringToThreadType[response.customId];
    const forumChannel = await message.client.channels.fetch(threadTypeToId[threadType]) as ForumChannel;
    const forumChannelWebhooks = await forumChannel.fetchWebhooks();
    const webhook = forumChannelWebhooks.size > 0 ? forumChannelWebhooks.first() : await forumChannel.createWebhook({ name: "Modmail Webhook", reason: "No webhook was present for the forum channel." });

    const newThread = await forumChannel.threads.create({
        name: `@${message.author.username}`,
        autoArchiveDuration: 1440,
        reason: "New modmail thread",
        message: {
            content: `<@&${NEW_THREAD_NOTIFICATION_ROLE_ID}> <@${message.author.id}> (${message.author.id}) has started a new modmail thread.\nUse</anonymous:1155692109265903636> to hide the identity of moderators participating in this thread.`,
        components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId("close_thread").setLabel("Close Thread").setStyle(ButtonStyle.Danger).setEmoji("🔒")
                )
            ]
        }
    });

    newThread.setName(`${newThread.name} [${newThread.id}]`);

    await db.collection<ActiveThread>("active_threads").insertOne({
        userId: message.author.id,
        receivingThreadId: newThread.id,
        type: threadType,
        areModeratorsHidden: false
    });

    const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
    const leftoverFiles = [...message.attachments.values()].filter(attachment => attachment.size > 25000000).map(attachment => attachment.url);

    let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");;
    if (leftoverFiles.length > 0) {
        messageContent += `\n\n${leftoverFiles.join("\n")}`;
    }

    const messageContentSplit = splitMessage(messageContent);
    for (let i = 0; i < messageContentSplit.length; i++) {
        webhook.send({
            threadId: newThread.id,
            content: messageContentSplit[i],
            username: guildMember.displayName,
            avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
            files: i === messageContentSplit.length - 1 ? files : []
        });
    }

    if (messageContentSplit.length === 0) {
        webhook.send({
            threadId: newThread.id,
            username: guildMember.displayName,
            avatarURL: message.author.displayAvatarURL({ forceStatic: true }),
            files: files
        });
    }

    mailTypeMessage.edit({
        content: "",
        embeds: [
            new EmbedBuilder()
                .setTitle("Message Sent!")
                .setColor("#007acc")
                .setDescription("A line has been opened to the staff team. A staff member will respond momentarily.")
                .addFields({ name: "Conversation ID", value: newThread.id, inline: true })
        ],
        components: []
    });
}
