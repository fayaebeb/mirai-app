import { atom } from 'recoil';
export type ActiveTab = 'chat' | 'notes' | 'goals' | 'mindmap';
export const activeTabState = atom<ActiveTab>({
  key: 'activeTabStateAtom', // unique ID for the atom
  default: "chat", // default state (false = closed)
});
