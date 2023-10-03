import { ChatInputCommandInteraction, CommandInteraction, MessageFlags } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import { ANONYMOUS_COMMAND_PREFIX } from "../constants";

export default async function anonymousSlashCommand(interaction: ChatInputCommandInteraction) {
    const activeThread = await mongoDatabase.collection("active_threads").findOne<ActiveThread>({ receivingThreadId: interaction.channel.id });

    if (interaction.options.getBoolean("state") === null) {
        await interaction.reply({
            content: `Moderator identities are currently ${activeThread.areModeratorsHidden ? "hidden" : "visible"}. Use ${ANONYMOUS_COMMAND_PREFIX}identity to selectively ${activeThread.areModeratorsHidden ? "reveal" : "hide"} your identity.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const newValue = interaction.options.getBoolean("state");
    await mongoDatabase.collection("active_threads").updateOne({ receivingThreadId: interaction.channel.id }, { $set: { areModeratorsHidden: newValue } });

    await interaction.reply({
        content: `Moderator identities are now ${newValue ? "hidden" : "revealed"}. To ${newValue ? "reveal" : "hide"} your identity for a specific message, prepend your message with \`${ANONYMOUS_COMMAND_PREFIX}identity\`.`
    });
}
