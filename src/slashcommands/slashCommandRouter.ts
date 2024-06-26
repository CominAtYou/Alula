import { CommandInteraction } from "discord.js";
import anonymousSlashCommand from "./anonymous";
import disableModmail from "./disableModmail";
import closeThreadSlashCommand from "./closeThread";
import clearUserEntry from "./clear";

const slashCommands = {
    "1158087318431867023": anonymousSlashCommand,
    "1158611799088828518": disableModmail,
    "1158860642669830185": closeThreadSlashCommand,
    "1181828360511438920": clearUserEntry
}

export default async function slashCommandRouter(interaction: CommandInteraction) {
    if (slashCommands[interaction.commandId]) {
        await slashCommands[interaction.commandId](interaction);
    }
}
