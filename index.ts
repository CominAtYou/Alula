import { ChannelType, Client, GatewayIntentBits, GuildTextBasedChannel, Partials } from 'discord.js';
import handlePrivateMessage from './src/conversationHandlers/privateMessageHandler';
import handleThreadMessage from './src/conversationHandlers/threadMessageHandler';
import buttonHandler from './src/buttonHandlers/buttonHandler';
import { DISCORD_BOT_TOKEN } from './src/secrets';
import { createMongoConnection, getMongoDatabase } from './src/db/mongoInstance';
import slashCommandRouter from './src/slashcommands/slashCommandRouter';
import express = require('express');
import http = require('http');

const app = express();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.channel.type == ChannelType.DM) {
        await handlePrivateMessage(message);
    }
    else if (message.channel.type == ChannelType.PublicThread) {
        await handleThreadMessage(message);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        await buttonHandler(interaction);
    }
    else if (interaction.isCommand()) {
        slashCommandRouter(interaction);
    }
});

client.login(DISCORD_BOT_TOKEN);

app.get("/*", async (req, res) => {
    const path = req.path.split("/").slice(1);

    if (path.length !== 4 || !req.query.expectedtype) {
        res.sendStatus(400);
        return;
    }

    const db = getMongoDatabase();
    const cachedLink = await db.collection("attachment_link_cache").findOne({ channelId: path[0], messageId: path[1], attachmentSnowflake: path[2], filename: decodeURIComponent(path[3]) });

    if (cachedLink) {
        res.redirect(cachedLink.attachmentLink);
        return;
    }

    try {
        var channel = await client.channels.fetch(path[0]) as GuildTextBasedChannel;
        var message = await channel.messages.fetch(path[1]);
        var attachment = message.attachments.get(path[2]);
    }
    catch (e) {
        res.sendStatus(404);
        return;
    }

    if (!attachment) {
        if ((req.query.expectedtype as string).toLowerCase() === 'image') {
            // todo: send 'not found' image
        }
        else {
            res.sendStatus(404);
        }
        return;
    }

    const expires = parseInt("0x" + new URLSearchParams(attachment.url).get("ex"));

    await db.collection("attachment_links").insertOne({
        expireAt: new Date(expires),
        channelId: path[0],
        messageId: path[1],
        attachmentSnowflake: path[2],
        filename: attachment.name,
        attachmentLink: attachment.url
    });

    res.redirect(attachment.url);
});

client.once('ready', async client => {
    console.log(`Logged in as ${client.user.tag}!`);
    await createMongoConnection();

    const server = http.createServer(app);
    server.listen(3000, () => console.log("HTTP server ready!"));
});
