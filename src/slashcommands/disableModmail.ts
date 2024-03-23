import { ChatInputCommandInteraction } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import GuildConfig from "../types/GuildConfig";

export default async function disableModmail(interaction: ChatInputCommandInteraction) {
    const newState = interaction.options.getBoolean("disabled", true);
    const config = mongoDatabase.collection<GuildConfig>(`guildconfigs`);

    await config.updateOne({ guildId: interaction.guildId }, { $set: { modmailDisabled: newState } }, { upsert: true });
    await interaction.reply(`New modmail threads have been ${newState ? "disabled" : "enabled"}.`);
}
