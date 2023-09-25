import Attachment from "./Attachment";

export type ElementEntry =
  | { type: 'text'; content: string }
  | { type: 'attachment'; content: Attachment };
