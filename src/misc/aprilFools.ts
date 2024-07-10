import { Message } from "discord.js";

export default function aprilFools(message: Message) {
    if (message.channel.id !== "222106327210655745") return;

    if (Math.random() < 0.0001) {
        message.react("❌");
    }
}
