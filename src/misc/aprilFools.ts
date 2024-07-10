import { Message } from "discord.js";

export default function aprilFools(message: Message) {
    const staffGatedChannels = ["397947605705031680", "831705788438806549"];
    const publicChannels = ["222106327210655745", "222099381514403842", "686082945160839241"];

    // Staff and public channels have separate chances of getting the reaction, hence the two if statements

    if (staffGatedChannels.includes(message.channel.id) && Math.random() < 0.0001) {
        message.react("❌");
    }

    if (publicChannels.includes(message.channel.id) && Math.random() < 0.0001) {
        message.react("❌");
    }
}
