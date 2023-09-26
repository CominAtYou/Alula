import { Collection, GuildMember, Message, MessageType } from "discord.js";
import cheerio = require("cheerio");
import { readFile } from "fs/promises";
import { ThreadType } from "../types/ThreadType";
import ConversationDetails from "../types/ConversationDetails";
import Attachment from "../types/Attachment";
import { ElementEntry } from "../types/ElementEntry";
import { minify } from "html-minifier";
import bytesToSize from "../util/fileSizes";

const FILE_SVG = `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"></path></svg>`;

export default async function generateTranscript(details: ConversationDetails, messages: Message[], moderators: Collection<string, GuildMember>, hideModerators: boolean) {
    const filteredMessages = messages.filter(message => message.type === MessageType.Default && (!message.author.bot || message.webhookId));

    const template = await readFile("./src/transcript/transcript-template.html", 'utf-8');
    const $ = cheerio.load(template);
    const groups: Message[][] = [];
    let currentAuthor = filteredMessages[0].webhookId || filteredMessages[0];
    let currentGroup: Message[] = [];

    filteredMessages.forEach(message => {
        if ((message.webhookId || message.author.id) === currentAuthor) {
            currentGroup.push(message);
        }
        else {
            groups.push(currentGroup);
            currentGroup = [message];
            currentAuthor = message.webhookId || message.author.id;
        }
    });

    groups.push(currentGroup);

    for (let i = 0; i < groups.length; i++) {
        const currentGroup = groups[i];
        const side = currentGroup[0].webhookId ? 'left': 'right';
        const elementList: ElementEntry[] = [];

        let author: { username: string, avatarURL: string };

        if (side === 'left') {
            author = { username: details.creator.username, avatarURL: details.creator.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) };
        }
        else if (side === 'right' && hideModerators) {
            author = { username: "Staff Member", avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png" };
        }
        else {
            author = { username: currentGroup[0].author.username, avatarURL: currentGroup[0].author.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) };
        }

        for (let j = 0; j < currentGroup.length; j++) {
            const message = currentGroup[j];
            const attachments: Attachment[] = [];

            message.attachments.forEach(attachment => {
                attachments.push({
                    name: attachment.name,
                    url: attachment.url,
                    size: attachment.size,
                    contentType: attachment.contentType
                });
            });

            const urlAttachments = message.content.match(/https:\/\/cdn\.discordapp\.com\/[^\s]*/g);
            const filteredMessageContent = message.content.replace(/https:\/\/cdn\.discordapp\.com\/[^\s]*/g, "").replace(/\n+$/, "").replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank">$&</a>');

            if (urlAttachments) {
                for (const attachment of urlAttachments) {
                    try {
                        const data = await fetch(attachment, { method: "HEAD" });
                        const contentType = data.headers.get("Content-Type");
                        const size = data.headers.get("Content-Length");

                        attachments.push({
                            name: attachment.split("/").pop(),
                            url: attachment,
                            size: parseInt(size),
                            contentType: contentType
                        });
                    }
                    catch {
                        attachments.push({
                            name: attachment.split("/").pop(),
                            url: attachment,
                            size: 0,
                            contentType: "application/octet-stream"
                        });
                    }
                }
            }

            if (filteredMessageContent !== "") {
                elementList.push({ type: "text", content: filteredMessageContent });
            }

            if (attachments.length > 0) {
                attachments.forEach(attachment => {
                    elementList.push({ type: "attachment", content: attachment });
                });
            }
        }

        const messageElement = $(`<div class="chathead-${side}"></div>`);
        messageElement.append(`<p class="message-details">@${author.username} &bull; </p>`);
        messageElement.append(`<div style="display: none;" class="message-timestamp">${currentGroup[0].createdAt.getTime()}</div>`);

        for (let j = 0; j < elementList.length; j++) {
            const element = elementList[j];

            if (j === 0) {
                const firstMessage = $(`<div class="chathead-first-message"></div>`);
                firstMessage.append(`<img class="chathead-avatar" src="${author.avatarURL}" />`);
                if (element.type === "text") {
                    const messageBubble = $(`<div class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}"></div>`);
                    messageBubble.append(`<p>${element.content}</p>`);
                    firstMessage.append(messageBubble);
                }
                else {
                    if (element.content.contentType.startsWith("image/") && element.content.contentType !== "image/svg+xml") {
                        const messageBubble = (`<img class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}" src="${element.content.url}" />`);
                        firstMessage.append(messageBubble);
                    }
                    else if (element.content.contentType.startsWith("video/")) {
                        const messageBubble = (`<video class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}" controls><source src="${element.content.url}" type="${element.content.contentType}"></video>`);
                        firstMessage.append(messageBubble);
                    }
                    else {
                        const file_anchor = $(`<a aria-label="button" class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"} message-bubble-file" href="${element.content.url}">${FILE_SVG}</a>`);
                        file_anchor.append(`<div class="file-details"><p>${element.content.name}<p><p>${bytesToSize(element.content.size)} bytes</p></div>`);
                        firstMessage.append(file_anchor);
                    }
                }

                messageElement.append(firstMessage);
            }
            else {
                const bubbleType = j === elementList.length - 1 ? "message-bubble-final" : "message-bubble-middle";

                if (element.type === "text") {
                    const messageBubble = $(`<div class="message-bubble ${bubbleType}"></div>`);
                    messageBubble.append(`<p>${element.content}</p>`);
                    messageElement.append(messageBubble);
                }
                else {
                    if (element.content.contentType.startsWith("image/") && !element.content.contentType.startsWith("image/svg+xml")) {
                        const messageBubble = (`<img class="message-bubble ${bubbleType}" src="${element.content.url}" />`);
                        messageElement.append(messageBubble);
                    }
                    else if (element.content.contentType.startsWith("video/")) {
                        const messageBubble = (`<video class="message-bubble ${bubbleType}" controls><source src="${element.content.url}" type="${element.content.contentType}"></video>`);
                        messageElement.append(messageBubble);
                    }
                    else {
                        const file_anchor = $(`<a aria-label="button" class="message-bubble ${bubbleType} message-bubble-file" href="${element.content.url}">${FILE_SVG}</a>`);
                        file_anchor.append(`<div class="file-details"><p>${element.content.name}<p><p>${bytesToSize(element.content.size)}</p></div>`);
                        messageElement.append(file_anchor);
                    }
                }
            }
        }

        $("#conversation-content").append(messageElement);
    }

    $("#navbar-icon").attr("src", details.guild.iconURL({ extension: 'png', size: 128, forceStatic: true }) || "https://cdn.discordapp.com/embed/avatars/0.png");

    $("#conversation-details-avatar").attr("src", details.creator.displayAvatarURL({ forceStatic: true }));
    $("#conversation-details-username").text("@" + details.creator.username);
    $("#conversation-details-user-id").text(details.creator.id);

    $("#request-type").text(details.type === ThreadType.APPEAL ? "Appeal" : details.type === ThreadType.DATA ? "Data" : "Moderation");
    $("#conversation-id").text(details.threadId);
    $("#conversation-opened").parent().append(`<div style="display: none;" id="conversation-opened-time">${details.opened.getTime()}</div>`);
    $("#conversation-closed").parent().append(`<div style="display: none;" id="conversation-closed-time">${details.closed.getTime()}</div>`);

    if (hideModerators) {
        $("#conversation-closer-container").remove();
    }
    else {
        $("#conversation-closer").text(`@${details.closerUsername}`);
    }

    if (hideModerators) {
        $("#attending-moderators").remove();
    }
    else {
        const moderatorElementsContainer = $("#conversation-details-moderators-content");

        moderators.forEach(moderator => {
            const moderatorElement = $(`<div class="conversation-details-moderator-entry"></div>`)

            const avatarContainer = $(`<div class="moderator-avatar-container"></div>`);
            avatarContainer.append(`<img class="moderator-avatar" src="${moderator.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true })}" />`);
            moderatorElement.append(avatarContainer);

            const moderatorDetails = $(`<div class="moderator-details"></div>`);
            moderatorDetails.append(`<h3 class="moderator-username">@${moderator.user.username}</h3>`);
            moderatorDetails.append(`<p class="moderator-id">${moderator.id}</p>`);
            moderatorElement.append(moderatorDetails);

            moderatorElementsContainer.append(moderatorElement);
        });
    }

    return minify($.html(), {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        minifyCSS: true,
        minifyJS: true
    });
}
