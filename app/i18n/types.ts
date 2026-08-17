/** Supported in-app locales. Keep in sync with SUPPORTED_LOCALES in locales.js. */
export type AppLocale =
  | "en"
  | "cs"
  | "da"
  | "nl"
  | "fi"
  | "fr"
  | "de"
  | "it"
  | "ko"
  | "nb"
  | "pl"
  | "pt-BR"
  | "pt-PT"
  | "es"
  | "sv"
  | "tr"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "th";

export type TextDirection = "ltr" | "rtl";

export type LocaleConfig = {
  code: AppLocale;
  name: string;
  direction: TextDirection;
};

export type TranslateVars = Record<string, string | number | null | undefined>;
