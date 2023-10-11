export default interface CachedAttachment {
    expireAt: Date;
    channelId: string;
    messageId: string;
    attachmentId: string;
    filename: string;
    attachmentUrl: string;
}
