import { atom } from "recoil";

export const dropdownOpenState = atom<boolean>({
  key: "dropdownOpenState",
  default: false,
});