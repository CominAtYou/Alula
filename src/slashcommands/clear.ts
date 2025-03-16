import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, ThreadChannel } from "discord.js";
import ActiveThread from "../types/ActiveThread";
import { mongoDatabase } from "../db/mongoInstance";
import closeThread from "../threads/closeThread";

export default async function clearUserEntry(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user", true);
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ userId: targetUser.id });

    if (!activeThread) {
        await interaction.reply(`There doesn't seem to be anything to do - ${targetUser.displayName} you specified doesn't have an entry in the database. If the user is having trouble opening a thread, this command likely isn't the solution.`);
        return;
    }

    let threadIsActive = false;
    let threadChannel: ThreadChannel;
    try {
        threadChannel = await interaction.client.channels.fetch(activeThread.receivingThreadId) as ThreadChannel;
        threadIsActive = !threadChannel.archived;
    }
    catch {
        threadIsActive = false;
    }

    if (threadIsActive) {
        const warningMessage = await interaction.reply({
            content: `${targetUser.displayName} **currently has an open thread**, <#${threadChannel!.id}>. Proceeding with this command will close the thread.\n\nAre you sure you want to continue?`,
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_clear_user_entry")
                        .setLabel("Continue")
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId("cancel_clear_user_entry")
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        let response: ButtonInteraction;

        try {
            response = await warningMessage.awaitMessageComponent<ComponentType.Button>({ time: 30000, filter: i => i.user.id === interaction.user.id });
        }
        catch {
            await warningMessage.edit({ content: "This command timed out. Please run the command again if you wish to try again.", components: [] });
            return;
        }

        if (response.customId === "cancel_clear_user_entry") {
            await response.update({ content: "Operation canceled.", components: [] });
        }
        else {
            await response.update({ content: "<a:loading:1181489462484672575>  Just a sec...", components: [] });
            await closeThread(interaction.client, threadChannel!.id, interaction.user);
            await response.message.edit(`The thread has been closed and the user purged from the database. If ${targetUser.displayName} was having trouble opening a report, ask them to try again.`);
        }
    }
    else {
        await mongoDatabase.collection<ActiveThread>("active_threads").deleteMany({ userId: targetUser.id });
        await interaction.reply(`Successfully purged dangling entries for ${targetUser.displayName}. If they were having trouble opening a report, ask them to try again.`);
    }
}
