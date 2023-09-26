import { ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';
import handlePrivateMessage from './src/conversationHandlers/privateMessageHandler';
import handleThreadMessage from './src/conversationHandlers/threadMessageHandler';
import buttonHandler from './src/buttonHandlers/buttonHandler';
import { DISCORD_BOT_TOKEN } from './src/secrets';
import { createMongoConnection } from './src/db/mongoInstance';
import slashCommandRouter from './src/slashcommands/slashCommandRouter';

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

client.once('ready', async client => {
    console.log(`Logged in as ${client.user.tag}!`);
    createMongoConnection();
});

client.login(DISCORD_BOT_TOKEN);
