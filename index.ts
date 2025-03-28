import { ActivityType, ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';
import handlePrivateMessage from './src/conversationHandlers/privateMessageHandler';
import handleThreadMessage from './src/conversationHandlers/threadMessageHandler';
import buttonHandler from './src/buttonHandlers/buttonHandler';
import { DISCORD_BOT_TOKEN } from './src/secrets';
import { createMongoConnection, mongoDatabase } from './src/db/mongoInstance';
import slashCommandRouter from './src/slashcommands/slashCommandRouter';
import { readFile } from 'fs/promises';
import https = require('https');
import express = require('express');
import attachmentRetreival from './src/webserver/attachmentRetreival';
import ActiveThread from './src/types/ActiveThread';
import { APPEALS_FORUM_CHANNEL_ID, DATA_FORUM_CHANNEL_ID, MODERATION_FORUM_CHANNEL_ID, TEXT_COMMAND_PREFIX } from './src/constants';
import scheduleThreadExpiryTask from './src/threads/threadExpiryTask';
import textCommandHandler from './src/textcommands/textCommandHandler';
import aprilFools from './src/misc/aprilFools';

const app = express();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        await handlePrivateMessage(message);
    }
    else if (message.channel.type === ChannelType.PublicThread) {
        if (![MODERATION_FORUM_CHANNEL_ID, APPEALS_FORUM_CHANNEL_ID, DATA_FORUM_CHANNEL_ID].includes(message.channel.parent!.id)) return;

        await handleThreadMessage(message);
    }
    else if (message.content.startsWith(TEXT_COMMAND_PREFIX)) {
        textCommandHandler(message);
    }
    else {
        aprilFools(message);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        await buttonHandler(interaction);
    }
    else if (interaction.isChatInputCommand()) {
        slashCommandRouter(interaction);
    }
});

client.on('threadDelete', async thread => {
    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
});

client.login(DISCORD_BOT_TOKEN);

app.get("/*", async (req, res) => {
    await attachmentRetreival(req, res, client);
});

client.once('ready', async client => {
    await createMongoConnection();
    console.log(`Logged in as ${client.user.tag}!`);

    const credentials = { key: await readFile('ssl/key.pem'), cert: await readFile('ssl/cert.pem') };

    client.user.setActivity({ name: "Eating rocks since 2014", type: ActivityType.Custom });
    https.createServer(credentials, app).listen(3000, () => console.log("HTTPS server ready!"));

    scheduleThreadExpiryTask(client);
});
