import { ActivityType, Message } from "discord.js";

export default async function setStatus(message: Message, args: string[]) {
    const application = await message.client.application.fetch();
    if (message.author.id !== application.owner.id) return;

    message.client.user.setActivity({ name: args.join(" "), type: ActivityType.Custom });
}
