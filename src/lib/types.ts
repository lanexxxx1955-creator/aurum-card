export type LangCode =
  | "en" | "ru" | "be" | "kk" | "uz" | "az" | "hy" | "ky" | "tg" | "tk" | "ro";

export interface LangInfo {
  code: LangCode;
  label: string;
  flag: string;
}

export interface Profile {
  name: string;
  tg: string;
  phone?: string;
  company?: string;
  field?: string;
  position?: string;
  lang: LangCode;
  photo?: string; // compressed dataURL
  hasVideo?: boolean;
  videoFileId?: string; // Telegram cloud file_id of the greeting video
  cardId?: string; // short KV id for share links (#c=...)
  pro?: boolean;
  proUntil?: number; // PRO subscription expiry timestamp (ms)
  createdAt?: number;
}

export type Step = "lang" | "form" | "photo" | "video" | "card" | "cabinet";

export const VIDEO_LIMIT_FREE = 20;
export const VIDEO_LIMIT_PRO = 60;
