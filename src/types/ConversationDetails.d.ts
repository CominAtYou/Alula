import { User } from "discord.js";
import { ThreadType } from "./ThreadType";

export default interface ConversationDetails {
    type: ThreadType;
    threadId: string;
    opened: Date;
    closed: Date;
    closerUsername: string;
    creator: User;
}
