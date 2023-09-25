import { ButtonInteraction } from "discord.js";
import closeThreadButtonHandler from "./closeThreadButton";

const buttonHandlers =  {
    "close_thread": closeThreadButtonHandler
}

export default async function buttonHandler(interaction: ButtonInteraction) {
    if (buttonHandlers[interaction.customId]) {
        await buttonHandlers[interaction.customId](interaction);
    }
}
