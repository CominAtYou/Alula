import { ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';
import handlePrivateMessage from './lib/conversationHandlers/privateMessageHandler';
import handleThreadMessage from './lib/conversationHandlers/threadMessageHandler';
import buttonHandler from './lib/buttonHandlers/buttonHandler';
import { DISCORD_BOT_TOKEN } from './lib/secrets';
import { createMongoConnection } from './lib/db/mongoInstance';
import slashCommandRouter from './lib/slashcommands/slashCommandRouter';

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
    await createMongoConnection();
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(DISCORD_BOT_TOKEN);
