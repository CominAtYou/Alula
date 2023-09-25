import { CommandInteraction } from "discord.js";
import anonymousSlashCommand from "./anonymous";

const slashCommands = {
    "anonymous": anonymousSlashCommand
}

export default async function slashCommandRouter(interaction: CommandInteraction) {
    if (slashCommands[interaction.commandName]) {
        await slashCommands[interaction.commandName](interaction);
    }
}
