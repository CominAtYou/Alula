import { ChatInputCommandInteraction, GuildTextBasedChannel } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import GuildConfig from "../types/GuildConfig";
import { DEBUG_LOG_CHANNEL_ID } from "../constants";

export default async function disableModmail(interaction: ChatInputCommandInteraction) {
    const newState = interaction.options.getBoolean("disabled", true);
    const config = mongoDatabase.collection<GuildConfig>(`guildconfigs`);

    await config.updateOne({ guildId: interaction.guildId! }, { $set: { modmailDisabled: newState } }, { upsert: true });
    await interaction.reply(`New modmail threads have been ${newState ? "disabled" : "enabled"}.`);

    const logChannel = (interaction.client.channels.cache.get(DEBUG_LOG_CHANNEL_ID) ?? await interaction.client.channels.fetch(DEBUG_LOG_CHANNEL_ID)) as GuildTextBasedChannel;
    await logChannel.send(`New modmail submissions have been ${newState ? "disabled" : "enabled"} by ${interaction.user.username}.`);
}
