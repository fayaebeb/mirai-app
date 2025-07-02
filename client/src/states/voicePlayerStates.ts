import { atom } from "recoil";

export const playingMessageIdAtom = atom<number | null>({
  key: "playingMessageId",
  default: null,
});

export const isProcessingVoiceAtom = atom<boolean>({
  key: "isProcessingVoice",
  default: false,
});

export const isPlayingAudioAtom = atom<boolean>({
  key: "isPlayingAudio",
  default: false,
});

export const currentAudioUrlAtom = atom<string | null>({
  key: "currentAudioUrl",
  default: null,
});

export const showTranscriptionConfirmationAtom = atom<boolean>({
  key: "showTranscriptionConfirmation", 
  default: false,
});

export const transcribedTextAtom = atom<string | null>({
  key: "transcribedText",
  default: null,
});