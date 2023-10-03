import { ActivityType, ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';
import handlePrivateMessage from './src/conversationHandlers/privateMessageHandler';
import handleThreadMessage from './src/conversationHandlers/threadMessageHandler';
import buttonHandler from './src/buttonHandlers/buttonHandler';
import { DISCORD_BOT_TOKEN } from './src/secrets';
import { createMongoConnection, mongoDatabase } from './src/db/mongoInstance';
import slashCommandRouter from './src/slashcommands/slashCommandRouter';
import express = require('express');
import http = require('http');
import attachmentRetreival from './src/webserver/attachmentRetreival';
import { ActiveThread } from './src/types/ActiveThread';

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

client.on('threadDelete', async thread => {
    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });
});

client.login(DISCORD_BOT_TOKEN);

app.get("/*", async (req, res) => {
    await attachmentRetreival(req, res, client);
});

client.once('ready', async client => {
    console.log(`Logged in as ${client.user.tag}!`);
    await createMongoConnection();

    client.user.setActivity({ name: "Eating rocks since 2014", type: ActivityType.Custom });
    const server = http.createServer(app);
    server.listen(3000, () => console.log("HTTP server ready!"));
});
