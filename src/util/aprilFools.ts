import { ChannelType, Client, GuildMember } from "discord.js";

const endDate = new Date("2024-04-02T05:00:00.000Z");

export default function startAprilFools(client: Client) {
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (endDate.getTime() < Date.now()) return;

        if (reaction.partial) {
            reaction = await reaction.fetch();
        }

        if (reaction.message.channel.type !== ChannelType.GuildText || reaction.message.guildId !== "220667551364022272") return;

        const reactionUsers = await reaction.users.fetch();
        if (reaction.emoji.name === "✅" && reaction.count === 12 && reactionUsers.some(u => u.id === client.user.id)) {
            const member: GuildMember = await reaction.message.guild.members.fetch(reaction.message.author.id);

            if (!member) return;
            await member.roles.add("1224403762181836810");
        }
    });

    client.on('messageCreate', async message => {
        if (message.guildId !== "220667551364022272") return;
        if (message.channel.type !== ChannelType.GuildText) return;
        if (message.author.bot) return;
        if (endDate.getTime() < Date.now()) return;

        const chance = Math.random();
        if (chance < 0.2) {
            message.react("✅");
        }
        else if (chance < 0.4) {
            message.react('❌');
        }
    });
}
