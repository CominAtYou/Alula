import { ButtonInteraction } from "discord.js";
import closeThreadButtonHandler from "./closeThreadButton";

const buttonHandlers: { [key: string]: (interaction: ButtonInteraction) => Promise<void> } = {
    "close_thread": closeThreadButtonHandler
}

export default async function buttonHandler(interaction: ButtonInteraction) {
    if (buttonHandlers[interaction.customId]) {
        await buttonHandlers[interaction.customId](interaction);
    }
}
