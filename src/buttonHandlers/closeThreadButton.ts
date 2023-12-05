import { ButtonInteraction } from "discord.js";
import closeThread from "../threads/closeThread";


export default async function closeThreadButton(interaction: ButtonInteraction) {
    await closeThread(interaction.client, interaction.channelId, interaction.user);
}
