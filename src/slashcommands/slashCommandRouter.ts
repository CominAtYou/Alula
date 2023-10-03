import { CommandInteraction } from "discord.js";
import anonymousSlashCommand from "./anonymous";
import disableModmail from "./disableModmail";
import closeThread from "./closeThread";

const slashCommands = {
    "1158087318431867023": anonymousSlashCommand,
    "1158611799088828518": disableModmail,
    "1158860642669830185": closeThread
}

export default async function slashCommandRouter(interaction: CommandInteraction) {
    if (slashCommands[interaction.commandId]) {
        await slashCommands[interaction.commandId](interaction);
    }
}
