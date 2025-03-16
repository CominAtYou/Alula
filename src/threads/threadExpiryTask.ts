import { Client, ThreadChannel } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";
import closeThread from "./closeThread";
import { scheduleJob } from "node-schedule";
import { APPEALS_FORUM_CHANNEL_ID } from "../constants";

export default function scheduleThreadExpiryTask(client: Client) {
    scheduleJob('0 0 * * *', async () => {
        const threads = mongoDatabase.collection<ActiveThread>("active_threads").find();

        for await (const doc of threads) {
            const thread = await client.channels.fetch(doc.receivingThreadId) as ThreadChannel;
            const message = await thread.messages.fetch(thread.lastMessageId!);

            if (thread.parentId === APPEALS_FORUM_CHANNEL_ID) {
                continue;
            }

            // one week expiry
            if (Date.now() - message.createdTimestamp > 604800000) {
                await closeThread(client, thread.id, client.user!);
            }
        }
    })
}
