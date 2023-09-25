import { ThreadType } from "./ThreadType";

export interface ActiveThread {
    userId: string;
    receivingThreadId: string;
    type: ThreadType;
    areModeratorsHidden: boolean;
}
