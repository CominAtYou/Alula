import { Guild, User } from "discord.js";
import { ThreadType } from "./ThreadType";

export default interface ConversationDetails {
    type: ThreadType;
    threadId: string;
    guild: Guild;
    opened: Date;
    closed: Date;
    closerUsername: string;
    closerId: string;
    creator: User;
}
