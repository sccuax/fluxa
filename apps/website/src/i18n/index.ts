import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/config/site";
import { en, type Dictionary } from "./en";
import { es } from "./es";

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Locale from `Astro.currentLocale` (undefined => default). */
export function resolveLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** UI strings for a locale. Typed against the English dictionary. */
export function useTranslations(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Prefix a locale-less path ("/pricing") with the locale when needed. */
export function localizedPath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
