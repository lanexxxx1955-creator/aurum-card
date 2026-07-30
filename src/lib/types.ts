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
  pro?: boolean;
  createdAt?: number;
}

export type Step = "lang" | "form" | "photo" | "video" | "card";

export const VIDEO_LIMIT_FREE = 20;
export const VIDEO_LIMIT_PRO = 60;
