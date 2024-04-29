import Attachment from "./Attachment";

/** An element that can be shown in a transcript - either a text message or attachment. */
export type ElementEntry =
  | { type: 'text'; content: string }
  | { type: 'attachment'; content: Attachment };
