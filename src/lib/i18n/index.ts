import { en } from "./locales/en";
import type { TranslationDictionary, LocaleCode } from "./types";

export type { TranslationDictionary, LocaleCode };

const dictionaries: Record<LocaleCode, TranslationDictionary> = {
  en,
};

class I18nStore {
  locale = $state<LocaleCode>("en");

  get dict(): TranslationDictionary {
    return dictionaries[this.locale] || en;
  }

  setLocale(newLocale: LocaleCode) {
    this.locale = newLocale;
  }
}

export const i18n = new I18nStore();

type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends []
  ? never
  : T extends [infer F]
  ? F
  : T extends [infer F, ...infer R]
  ? F extends string
    ? string extends F
      ? string
      : `${F}${D}${Join<Extract<R, string[]>, D>}`
    : never
  : string;

export type TranslationKey = Join<PathsToStringProps<TranslationDictionary>, ".">;

export function t(
  keyPath: TranslationKey,
  params?: Record<string, string | number>
): string {
  const parts = keyPath.split(".");
  let current: any = i18n.dict;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return keyPath;
    }
  }

  if (typeof current !== "string") {
    return keyPath;
  }

  if (!params) {
    return current;
  }

  let result = current;
  for (const [k, val] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
  }
  return result;
}
