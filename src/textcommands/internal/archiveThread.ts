import { Message, ThreadChannel } from "discord.js";
import { mongoDatabase } from "../../db/mongoInstance";
import ActiveThread from "../../types/ActiveThread";

const quips = [
    "Elodie is dumb",
    "Vee owes me 50 dollars to this day",
    "Ksxp is a simp",
    "Chris's name is Chris",
    "Nico's Crown Vic is plotting its vengenace on him"
];

export default async function archiveThread(message: Message, args: string[]) {
    if (message.author.id !== ((await message.client.application.fetch()).owner.id)) {
        return;
    }

    if (args.length < 1 || !(/[0-9]{18,}/.test(args[0]))) {
        message.channel.send("Please provide a valid thread ID.");
        return;
    }

    const channel = (message.client.channels.cache.get(args[0]) ?? await message.client.channels.fetch(args[0]));

    if (!channel.isThread()) {
        message.channel.send("That channel isn't a thread.");
        return;
    }

    const thread = channel as ThreadChannel;

    if (thread.archived) {
        message.channel.send("That thread is already archived.");
        return;
    }

    await thread.setArchived(true);
    await mongoDatabase.collection<ActiveThread>("active_threads").deleteOne({ receivingThreadId: thread.id });

    const quip = quips[Math.floor(Math.random() * quips.length)];
    message.channel.send(`Done! Thread archived.\n-# Did you know that ${quip}?`);
}
