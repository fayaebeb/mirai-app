import { DbType } from "@shared/schema";
import { atom } from "recoil";

export const isChatDialogOpenAtom = atom<boolean>({
  key: "isChatDialogOpenAtom",
  default: false,
});

export const activeChatDbTypeAtom = atom<DbType>({
  key: "activeChatDbType",
  default: "db1", // or 'db1' as your default
});