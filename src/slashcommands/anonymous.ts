import { CommandInteraction } from "discord.js";
import { getMongoDatabase } from "../db/mongoInstance";
import { ActiveThread } from "../types/ActiveThread";

export default async function anonymousSlashCommand(interaction: CommandInteraction) {
    const db = getMongoDatabase();
    const activeThread = await db.collection("active_threads").findOne<ActiveThread>({ receivingThreadId: interaction.channel.id });

    if (activeThread.areModeratorsHidden) {
        await interaction.reply("Moderator identities are already hidden.");
        return;
    }

    await db.collection("active_threads").updateOne({ receivingThreadId: interaction.channel.id }, { $set: { areModeratorsHidden: true } });

    await interaction.reply({
        content: `Moderator identities are now hidden.`,
    });
}
