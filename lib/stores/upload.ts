import { create } from "zustand";

type UploadState = {
  progress: number | null;
  busy: boolean;
  message: string;
  start: () => void;
  update: (progress: number) => void;
  setMessage: (message: string) => void;
  finish: () => void;
  reset: () => void;
};

/**
 * Shared client state for the admin upload form. Server data is never copied
 * into this store; it only tracks the in-flight browser upload.
 */
export const useUploadStore = create<UploadState>((set) => ({
  progress: null,
  busy: false,
  message: "",
  start: () => set({ progress: 0, busy: true, message: "" }),
  update: (progress) => set({ progress }),
  setMessage: (message) => set({ message }),
  finish: () => set({ progress: null, busy: false }),
  reset: () => set({ progress: null, busy: false, message: "" }),
}));
