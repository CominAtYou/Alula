import { ChatInputCommandInteraction } from "discord.js";
import anonymousSlashCommand from "./anonymous";
import disableModmail from "./disableModmail";
import closeThreadSlashCommand from "./closeThread";
import clearUserEntry from "./clear";
import { disableAppeals } from "./disableAppeals";

const slashCommands: { [key: string]: (arg0: ChatInputCommandInteraction) => Promise<void> } = {
    "1158087318431867023": anonymousSlashCommand,
    "1158611799088828518": disableModmail,
    "1158860642669830185": closeThreadSlashCommand,
    "1181828360511438920": clearUserEntry,
    "1350648005153521665": disableAppeals
}

export default async function slashCommandRouter(interaction: ChatInputCommandInteraction) {
    if (slashCommands[interaction.commandId]) {
        await slashCommands[interaction.commandId](interaction);
    }
}
