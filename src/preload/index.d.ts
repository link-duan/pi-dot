import type { PiApi } from "@shared/api";

declare global {
  interface Window {
    pi: PiApi;
  }
}

export {};
