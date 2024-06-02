import { Message } from "discord.js";
import setStatus from "./internal/status";
import { TEXT_COMMAND_PREFIX } from "../constants";

const commands = {
    "status": setStatus
}

export default function textCommandHandler(message: Message) {
    const args = message.content.split(" ");
    const command = args.shift().toLowerCase().slice(TEXT_COMMAND_PREFIX.length)

    if (commands[command]) {
        commands[command](message, args);
    }
}
