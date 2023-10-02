import { Client, GuildTextBasedChannel } from "discord.js";
import { Request, Response } from "express";
import { getMongoDatabase } from "../db/mongoInstance";

export default async function attachmentRetreival(req: Request, res: Response, client: Client) {
    const path = req.path.split("/").slice(1);

    if (path.length !== 4 || !req.query.expectedtype) {
        res.sendStatus(400);
        return;
    }

    const db = getMongoDatabase();
    const cachedLink = await db.collection("attachment_link_cache").findOne({ channelId: path[0], messageId: path[1], attachmentSnowflake: path[2], filename: decodeURIComponent(path[3]) });

    if (cachedLink) {
        res.redirect(cachedLink.attachmentLink);
        return;
    }

    try {
        var channel = await client.channels.fetch(path[0]) as GuildTextBasedChannel;
        var message = await channel.messages.fetch(path[1]);
    }
    catch (e) {
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

    const expires = parseInt("0x" + new URLSearchParams(attachment.url).get("ex"));

    await db.collection("attachment_links").insertOne({
        expireAt: new Date(expires),
        channelId: path[0],
        messageId: path[1],
        attachmentSnowflake: path[2],
        filename: attachment.name,
        attachmentLink: attachment.url
    });

    res.redirect(attachment.url);
}
