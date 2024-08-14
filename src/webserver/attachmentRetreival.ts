import { Client, GuildTextBasedChannel } from "discord.js";
import { Request, Response } from "express";
import { mongoDatabase } from "../db/mongoInstance";
import CachedAttachment from "../types/CachedAttachment";

export default async function attachmentRetreival(req: Request, res: Response, client: Client) {
    if (req.path === "/") {
        return res.setHeader("Content-Type", "text/plain").send("Calamus! You finally found Alula! But if you were looking for anything else, you'll need a path.");
    }

    const path = req.path.split("/").slice(1);

    if (path.length !== 4 || !req.query.expectedtype) {
        res.sendStatus(400);
        return;
    }

    const cachedLink = await mongoDatabase.collection<CachedAttachment>("attachment_link_cache").findOne({ channelId: path[0], messageId: path[1], attachmentId: path[2], filename: decodeURIComponent(path[3]) });

    if (cachedLink) {
        res.redirect(cachedLink.attachmentUrl);
        return;
    }

    try {
        var channel = await client.channels.fetch(path[0]) as GuildTextBasedChannel;
        var message = await channel.messages.fetch(path[1]);
    }
    catch {
        if ((req.query.expectedtype as string).toLowerCase() === 'image') {
            res.sendFile("image_not_found.png", { root: `${process.cwd()}/src/assets` });
        }
        else {
            res.sendStatus(404);
        }
        return;
    }

    const attachment = message.attachments.get(path[2]);

    if (!attachment) {
        if ((req.query.expectedtype as string).toLowerCase() === 'image') {
            res.sendFile("image_not_found.png", { root: `${process.cwd()}/src/assets` });
        }
        else {
            res.sendStatus(404);
        }
        return;
    }

    const expires = parseInt(new URL(attachment.url).searchParams.get("ex"), 16);

    await mongoDatabase.collection<CachedAttachment>("attachment_link_cache").insertOne({
        expireAt: new Date(expires * 1000),
        channelId: path[0],
        messageId: path[1],
        attachmentId: path[2],
        filename: attachment.name,
        attachmentUrl: attachment.url
    });

    res.redirect(attachment.url);
}
