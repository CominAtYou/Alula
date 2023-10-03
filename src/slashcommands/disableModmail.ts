import { ChatInputCommandInteraction } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import GuildConfig from "../types/GuildConfig";

export default async function disableModmail(interaction: ChatInputCommandInteraction) {
    const newState = interaction.options.getBoolean("disabled");
    const config = mongoDatabase.collection<GuildConfig>(`guildconfigs`);

    if (config.findOne({ guildId: interaction.guildId })) {
        await config.updateOne({ guildId: interaction.guildId }, { $set: { modmailDisabled: newState } });
        await interaction.reply(`New modmail threads have been ${newState ? "disabled" : "enabled"}`);
    }
    else {
        await config.insertOne({ guildId: interaction.guildId, modmailDisabled: newState });
        await interaction.reply(`New modmail threads have been ${newState ? "disabled" : "enabled"}`);
    }
}
