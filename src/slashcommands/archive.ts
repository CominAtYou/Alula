import { EmbedBuilder } from "@discordjs/builders";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Channel, ChatInputCommandInteraction, ComponentType, ThreadChannel } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";

const quips = [
    "Elodie is dumb",
    "Vee owes me 50 dollars to this day",
    "Ksxp is a simp",
    "Chris's name is Chris",
    "Nico's Crown Vic is plotting its vengenace on him"
];

export default async function archiveThread(interaction: ChatInputCommandInteraction) {
    const threadId = interaction.options.getString("thread_id", true);

    if (/[0-9]{18,}/.test(threadId) === false) {
        await interaction.reply("Please provide a valid Thread ID.");
        return;
    }

    const quip = quips[Math.floor(Math.random() * quips.length)];

    let channel: Channel;
    try {
        channel = (interaction.client.channels.cache.get(threadId) ?? await interaction.client.channels.fetch(threadId))!;
    }
    catch {
        interaction.channel!.send(`That thread doesn't seem to exist.\n-# Did you know that ${quip}?`);
        return;
    }

    if (!channel.isThread()) {
        await interaction.reply("That channel isn't a thread.");
        return;
    }

    const thread = channel as ThreadChannel;

    if (thread.archived) {
        await interaction.reply("That thread is already archived.");
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("Hold Up!")
        .setDescription("You're about to force close this thread. If the thread is still open, it will immediately be closed and cannot be reopened.\n\n Are you sure you want to do this?")
        .setColor(0xED4245)
        .setFooter({ text: `Did you know that ${quips[Math.floor(Math.random() * quips.length)]}?` })

    const confirmationMessage = await interaction.reply({ embeds: [embed], components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("confirm_archive").setLabel("Yes").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("cancel_archive").setLabel("No").setStyle(ButtonStyle.Secondary)
        )
    ]});

    let response: ButtonInteraction;
    try {
        response = await confirmationMessage.awaitMessageComponent<ComponentType.Button>({ filter: i => i.user.id === interaction.user.id, time: 30000 });
    }
    catch {
        await confirmationMessage.edit({ content: "This prompt has expired.", components: [] });
        return;
    }

    if (response.customId === "cancel_archive") {
        await confirmationMessage.edit({ content: `Canceled!\n-# Did you know that ${quip}?`, components: [] });
        return;
    }

    await thread.setArchived(true);
    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });

    confirmationMessage.edit({ content: `Done! Thread archived.\n-# Did you know that ${quip}?`, components: [] });
}
