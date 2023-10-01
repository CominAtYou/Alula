import { CommandInteraction } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";
import { ANONYMOUS_COMMAND_PREFIX } from "../constants";

export default async function anonymousSlashCommand(interaction: CommandInteraction) {
    const db = getMongoDatabase();
    const activeThread = await db.collection("active_threads").findOne<ActiveThread>({ receivingThreadId: interaction.channel.id });

    const newValue = !activeThread.areModeratorsHidden;
    await db.collection("active_threads").updateOne({ receivingThreadId: interaction.channel.id }, { $set: { areModeratorsHidden: newValue } });

    await interaction.reply({
        content: `Moderator identities are now ${newValue ? "hidden" : "revealed"} To ${newValue ? "reveal" : "hide"} your identity for a specific message, prepend your message with \`${ANONYMOUS_COMMAND_PREFIX}identity\`.`,
    });
}
