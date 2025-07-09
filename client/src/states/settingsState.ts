// src/state/atoms.ts
import { atom } from 'recoil';

export const settingsStateAtom = atom({
  key: 'settingsStateAtom', // unique ID for the atom
  default: false, // default state (false = closed)
});

export const sidePanelStateAtom = atom({
  key: 'sidePanelStateAtom', // unique ID for the atom
  default: false, // default state (false = closed)
});
