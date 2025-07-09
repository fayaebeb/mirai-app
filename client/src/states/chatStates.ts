import { Chat } from "@shared/schema";
import { Message } from "postcss";
import {
    atom,
    atomFamily,
    useRecoilState,
    useRecoilValue,
    useSetRecoilState,
} from "recoil";

export const chatsAtom = atom<Chat[]>({
    key: "chat/chats",
    default: [],
});

export const activeChatIdAtom = atom<number | null>({
    key: "chat/activeChatId",
    default: null,
});

export const messagesAtomFamily = atomFamily<Message[], number>({
    key: "chat/messagesByChat",
    default: [],
});