import { ChatInputCommandInteraction } from "discord.js"
import closeThread from "../threads/closeThread";

export default async function closeThreadSlashCommand(interaction: ChatInputCommandInteraction) {
    await closeThread(interaction.client, interaction.channelId, interaction.user);
}
