import { Collection, GuildMember, Message, MessageType } from "discord.js";
import cheerio = require("cheerio");
import { readFile } from "fs/promises";
import { ThreadType } from "../types/ThreadType";
import ConversationDetails from "../types/ConversationDetails";
import Attachment from "../types/Attachment";
import { ElementEntry } from "../types/ElementEntry";
import { minify } from "html-minifier";
import bytesToSize from "../util/fileSizes";
import { ATTACHMENT_RETREIVAL_DOMAIN, ANONYMOUS_COMMAND_PREFIX } from "../constants";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";
import isModeratorCompletelyAnonymous from "../util/anonymousChecks";

const FILE_SVG = `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"></path></svg>`;

export default async function generateTranscript(details: ConversationDetails, messages: Message[], moderators: Collection<string, GuildMember>, isReportForUser: boolean) {
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: details.threadId });;
    const template = await readFile("./src/transcript/transcript-template.html", 'utf-8');
    const $ = cheerio.load(template);

    /** Groups of messages that comes one after another from the same author. Used for laying out messages in the transcript. */
    const groups: Message[][] = [];
    let currentGroup: Message[] = [];
    let currentAuthor = messages[0].webhookId || messages[0].author.id; // This function runs in the context of the thread channel, so messages from the ticket opener will be webhooks.
    let isCurrentGroupAnonymous = activeThread.anonymousMessages.includes(messages[0].id);

    // If this report is for the reporter, we need to filter out messages that are anonymous and ensure that they are shown in a separate group from non-anonymous messages.
    if (isReportForUser) {
        messages.forEach(message => {
            const isCurrentMessageAnonymous = activeThread.anonymousMessages.includes(message.id);

            // If the current message meets the group's anonymity criteria, and the message is from the same author as the group, it gets added to the current group.
            if (((message.webhookId || message.author.id) === currentAuthor) && (isCurrentMessageAnonymous === isCurrentGroupAnonymous)) {
                currentGroup.push(message);
            }
            else { // If a criterion isn't met, we're done with the current group and push it into the groups array and start with a new group.
                groups.push(currentGroup);
                currentGroup = [message];
                currentAuthor = message.webhookId || message.author.id;
                isCurrentGroupAnonymous = activeThread.anonymousMessages.includes(message.id);
            }
        });
    }
    else { // If not, just group the messages based on author.
        messages.forEach(message => {
            if ((message.webhookId || message.author.id) === currentAuthor) {
                currentGroup.push(message);
            }
            else {
                groups.push(currentGroup);
                currentGroup = [message];
                currentAuthor = message.webhookId || message.author.id;
            }
        });
    }

    // One final push to add the last group to the groups array.
    groups.push(currentGroup);

    for (let i = 0; i < groups.length; i++) {
        const currentGroup = groups[i];
        const side = currentGroup[0].webhookId ? 'left': 'right'; // Messages from the ticket opener (so, with a webhook ID) will be on the left side of the transcript.

        /** A list of elements that can be shown in the transcript - each element being either a text message or an attachment. */
        const elementList: ElementEntry[] = [];

        let author: { username: string, avatarURL: string };

        // Fill in the author's details for the message group.
        if (side === 'left') {
            author = { username: `@${details.creator.username}`, avatarURL: details.creator.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) };
        }
        else if (side === 'right' && isReportForUser && activeThread.anonymousMessages.includes(currentGroup[0].id)) {
            author = { username: "Staff Member", avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png" };
        }
        else {
            author = { username: `@${currentGroup[0].author.username}`, avatarURL: currentGroup[0].author.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) };
        }

        for (let j = 0; j < currentGroup.length; j++) {
            const message = currentGroup[j];
            const attachments: Attachment[] = [];

            // Collect all the attachments uploaded alongside the message.
            message.attachments.forEach(attachment => {
                // expectedtype is the first part of the content type, e.g. image/png -> image
                attachments.push({
                    name: attachment.name,
                    url: `${ATTACHMENT_RETREIVAL_DOMAIN}/${message.channel.id}/${message.id}/${attachment.id}/${attachment.name}?expectedtype=${attachment.contentType.split("/")[0]}`,
                    size: attachment.size,
                    contentType: attachment.contentType
                });
            });

            // Find all the Discord CDN URLs in the message content
            const urlAttachments = message.content.match(/https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/[^\s]*/) || [];
            let filteredMessageContent = message.content;

            /*
            * For each URL, we need to:
            *  - Determine the expected type of the attachment (image, video, or any)
            *  - Remove the attachment URL from the message content
            *  - Replace the attachment URL with a ATTACHMENT_RETREIVAL_DOMAIN URL (because Discord CDN URLs expire)
            *  - (formatted as ${ATTACHMENT_URL_DOMAIN}/${channelId}/${messageId}/${attachmentSnowflake}/${filename}?expectedtype=${expectedType})
            */
            for (let k = 0; k < urlAttachments.length; k++) {
                const attachment = urlAttachments[k].split("?")[0];
                const path = attachment.split("/");
                const filename = path.pop();
                const attachmentSnowflake = path.pop();
                const channelId = path.pop();

                // Get the size and type of the attachment
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
                catch { // Assume the attachment is a standard file if we can't get the size and type
                    attachments.push({
                        name: attachment.split("/").pop(),
                        url: attachment,
                        size: 0,
                        contentType: "application/octet-stream"
                    });
                }

                const attachmentObject = attachments[attachments.length - 1]; // The attachment just added to the array
                const splitMime = attachmentObject.contentType.split("/")[0];
                const expectedType = splitMime === "video" || splitMime === "image" ? splitMime : "any";

                const webhookMessageMap = activeThread.webhookMessageMap.find(i => i.webhookMessageId === message.id);
                const messageId = webhookMessageMap ? webhookMessageMap.originalMessageId : message.id;

                filteredMessageContent = filteredMessageContent.replace(urlAttachments[k], ""); // Remove the attachment URL from the message content
                urlAttachments[k] = `${ATTACHMENT_RETREIVAL_DOMAIN}/${channelId}/${messageId}/${attachmentSnowflake}/${filename}?expectedtype=${expectedType}`
            }

            /*
             * Format the message content by:
                *  - Removing trailing newlines
                * - Replacing URLs with anchor tags
                * - Replacing newlines with <br> tags
                * - Removing the anonymous identity command if it's the first part of the message
            */
            filteredMessageContent = filteredMessageContent
                .replace(/\n+$/, "")
                .replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank">$&</a>')
                .replace(/\n/g, "<br>")
                .replace(new RegExp(`^${ANONYMOUS_COMMAND_PREFIX}identity `), "");

            // Mentions will show up as <@USER_ID>, so we need to replace them with the mention's display name
            const mentions = filteredMessageContent.match(/<@[#&]?[0-9]{17,}>/g) || [];

            for (let k = 0; k < mentions.length; k++) {
                const mention = mentions[k];

                if (mention[2] === '&') { // Role mentions are formatted as <@&ROLE_ID>
                    const roles = await details.guild.roles.fetch();
                    try {
                        const name = roles.find(role => role.id === mention.slice(3, -1)).name;
                        filteredMessageContent = filteredMessageContent.replace(mention, `@${name}`);
                    }
                    catch {
                        continue;
                    }
                }
                else if (mention[2] === '#') { // Channel mentions are formatted as <@#CHANNEL_ID>
                    const channels = await details.guild.channels.fetch();
                    try {
                        const name = channels.find(channel => channel.id === mention.slice(3, -1)).name;
                        filteredMessageContent = filteredMessageContent.replace(mention, `#${name}`);
                    }
                    catch {
                        continue;
                    }
                }
                else { // User mentions show up as <@USER_ID>
                    const members = await details.guild.members.fetch();
                    try {
                        const name = members.find(member => member.id === mention.slice(2, -1)).displayName;
                        filteredMessageContent = filteredMessageContent.replace(mention, `@${name}`);
                    }
                    catch {
                        continue;
                    }
                }
            }

            // If the message has textual content, add it to the element list
            if (filteredMessageContent !== "") {
                elementList.push({ type: "text", content: filteredMessageContent });
            }

            // If any attachments were processed, add them to the element list
            attachments.forEach(attachment => {
                elementList.push({ type: "attachment", content: attachment });
            });
        }

        const messageElement = $(`<div class="chathead-${side}"></div>`);
        messageElement.append(`<p class="message-details">${author.username} &bull; </p>`);
        messageElement.append(`<div style="display: none;" class="message-timestamp">${currentGroup[0].createdAt.getTime()}</div>`);

        // Iterate over all the elements and add them to the transcript HTML
        for (let j = 0; j < elementList.length; j++) {
            const element = elementList[j];

            if (j === 0) { // The first message in a group needs to have a timestamp and the avatar of the sender
                const firstMessage = $(`<div class="chathead-first-message"></div>`);
                firstMessage.append(`<img class="chathead-avatar" src="${author.avatarURL}" onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />`); // fall back to default Discord avatar

                /*
                 * Pick the correct kind of message bubble based on the type of element.
                 * The bubble will then get appended to this group's messageElement element.
                 */
                if (element.type === "text") {
                    const messageBubble = $(`<div class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}"></div>`);
                    messageBubble.append(`<p>${element.content}</p>`);
                    firstMessage.append(messageBubble);
                }
                else if (element.content.contentType.startsWith("image/") && element.content.contentType !== "image/svg+xml") {
                    const messageBubble = (`<img class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}" src="${element.content.url}" />`);
                    firstMessage.append(messageBubble);
                }
                else if (element.content.contentType.startsWith("video/")) {
                    const messageBubble = (`<video class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"}" controls><source src="${element.content.url}" type="${element.content.contentType}"></video>`);
                    firstMessage.append(messageBubble);
                }
                else {
                    const file_anchor = $(`<a aria-label="button" class="message-bubble ${elementList.length === 1 ? "message-bubble-single" : "message-bubble-initial"} message-bubble-file" href="${element.content.url}">${FILE_SVG}</a>`);
                    file_anchor.append(`<div class="file-details"><p>${element.content.name}</p><p>${bytesToSize(element.content.size)}</p></div>`);
                    firstMessage.append(file_anchor);
                }

                messageElement.append(firstMessage);
            }
            else { // We're working with a message that is either in the middle or the group or the final one.
                const bubbleType = j === elementList.length - 1 ? "message-bubble-final" : "message-bubble-middle";

                // Each bubble will has a class that determines how it looks, based on the element's position in the list.
                if (element.type === "text") {
                    const messageBubble = $(`<div class="message-bubble ${bubbleType}"></div>`);
                    messageBubble.append(`<p>${element.content}</p>`);
                    messageElement.append(messageBubble);
                }
                else if (element.content.contentType.startsWith("image/") && !element.content.contentType.startsWith("image/svg+xml")) {
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

        // Finally, append the message group HTML to the transcript content
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

    // for every moderator, check if they have a message in the messages array with an ID that isn't in the anonymousMessages array
    // if they have a message that isn't in the anonymousMessages array, then they are not anonymous

    const visibleModerators: GuildMember[] = [];

    if (isReportForUser) {
        // Filter out moderators who are completely anonymous from appearing in the "attending moderators" section.
        for (let i = 0; i < moderators.size; i++) {
            if (!isModeratorCompletelyAnonymous(moderators.at(i).id, messages, activeThread.anonymousMessages)) {
                visibleModerators.push(moderators.at(i));
            }
        }
    }
    else { // Staff transcripts will always show the moderators.
        visibleModerators.push(...moderators.values());
    }

    // If the thread was closed due to inactivity, remove the closer section.
    if (details.closerId === messages[0].client.user.id) {
        $("#conversation-closer-container").remove();
    }
    else if (isReportForUser) {
        if (isModeratorCompletelyAnonymous(details.closerId, messages, activeThread.anonymousMessages)) { // If the closer is anonymous, remove the closer section.
            $("#conversation-closer-container").remove();
        }
        else { // Otherwise, set the conversation closer text to the closer's username.
            $("#conversation-closer").text(`@${details.closerUsername}`);
        }
    }
    else { // Transcript is for staff; anonymity doesn't matter. Set the conversation closer text to the closer's username.
        $("#conversation-closer").text(`@${details.closerUsername}`);
    }

    // If there are no visible moderators, remove the entire moderator section.
    if (visibleModerators.length === 0) {
        $("#attending-moderators").remove();
    }
    else { // Otherwise, populate the moderator section with the visible moderators.
        const moderatorElementsContainer = $("#conversation-details-moderators-content");

        visibleModerators.forEach(moderator => {
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
