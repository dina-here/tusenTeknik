import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LanguageCode = "en" | "fi" | "no" | "dk" | "sv";

export const languageOptions: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fi", label: "FI" },
  { code: "no", label: "NO" },
  { code: "dk", label: "DK" },
  { code: "sv", label: "SV" }
];

const storageKey = "milleteknik.powerregister-ui.language";

const localeByLanguage: Record<LanguageCode, string> = {
  en: "en-GB",
  fi: "fi-FI",
  no: "nb-NO",
  dk: "da-DK",
  sv: "sv-SE"
};

const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    appTitle: "PowerRegister (demo)",
    appSubtitle: "Web PWA that simulates an Android app: QR/serial + offline queue + batch sync.",
    deviceRefLabel: "DeviceRef (QR or Serial)",
    noteLabel: "Note",
    installYearLabel: "Installation year",
    lastServiceYearLabel: "Last service year",
    contactNameLabel: "Contact - name",
    contactEmailLabel: "Contact - email",
    installYearPlaceholder: "e.g. 2020",
    lastServiceYearPlaceholder: "e.g. 2023",
    queueButton: "Add to offline queue",
    syncButton: "Sync now (batch)",
    localhostWarning: "API_BASE points to localhost ({apiBase}). Set VITE_API_BASE in Render to your API URL.",
    queueCount: "Offline queue: {count}",
    queueEmpty: "The queue is empty.",
    syncing: "Syncing...",
    syncDone: "Sync complete. API response: {response}",
    syncFailed: "Sync failed: {message}",
    queued: "Added event to offline queue: {eventId}"
  },
  fi: {
    appTitle: "PowerRegister (demo)",
    appSubtitle: "Web-PWA, joka simuloi Android-sovellusta: QR/sarja + offline-jono + eräsynkronointi.",
    deviceRefLabel: "LaiteRef (QR tai sarja)",
    noteLabel: "Huomio",
    installYearLabel: "Asennusvuosi",
    lastServiceYearLabel: "Viimeisin huoltovuosi",
    contactNameLabel: "Yhteys - nimi",
    contactEmailLabel: "Yhteys - sähköposti",
    installYearPlaceholder: "esim. 2020",
    lastServiceYearPlaceholder: "esim. 2023",
    queueButton: "Lisää offline-jonoon",
    syncButton: "Synkronoi nyt (erä)",
    localhostWarning: "API_BASE osoittaa localhostiin ({apiBase}). Aseta VITE_API_BASE Renderissä API-osoitteeseesi.",
    queueCount: "Offline-jono: {count}",
    queueEmpty: "Jono on tyhjä.",
    syncing: "Synkronoidaan...",
    syncDone: "Synkronointi valmis. API-vastaus: {response}",
    syncFailed: "Synkronointi epäonnistui: {message}",
    queued: "Tapahtuma lisätty offline-jonoon: {eventId}"
  },
  no: {
    appTitle: "PowerRegister (demo)",
    appSubtitle: "Web-PWA som simulerer Android-app: QR/serienummer + offline-kø + batch-synk.",
    deviceRefLabel: "DeviceRef (QR eller serienummer)",
    noteLabel: "Notat",
    installYearLabel: "Installasjonsår",
    lastServiceYearLabel: "Siste serviceår",
    contactNameLabel: "Kontakt - navn",
    contactEmailLabel: "Kontakt - e-post",
    installYearPlaceholder: "f.eks. 2020",
    lastServiceYearPlaceholder: "f.eks. 2023",
    queueButton: "Legg i offline-kø",
    syncButton: "Synk nå (batch)",
    localhostWarning: "API_BASE peker til localhost ({apiBase}). Sett VITE_API_BASE i Render til API-URL-en din.",
    queueCount: "Offline-kø: {count}",
    queueEmpty: "Køen er tom.",
    syncing: "Synkroniserer...",
    syncDone: "Synk ferdig. API-svar: {response}",
    syncFailed: "Synk mislyktes: {message}",
    queued: "La hendelse i offline-kø: {eventId}"
  },
  dk: {
    appTitle: "PowerRegister (demo)",
    appSubtitle: "Web-PWA som simulerer Android-app: QR/serienummer + offline-kø + batch-synk.",
    deviceRefLabel: "DeviceRef (QR eller serienummer)",
    noteLabel: "Note",
    installYearLabel: "Installationsår",
    lastServiceYearLabel: "Seneste serviceår",
    contactNameLabel: "Kontakt - navn",
    contactEmailLabel: "Kontakt - e-mail",
    installYearPlaceholder: "fx 2020",
    lastServiceYearPlaceholder: "fx 2023",
    queueButton: "Læg i offline-kø",
    syncButton: "Synk nu (batch)",
    localhostWarning: "API_BASE peger på localhost ({apiBase}). Sæt VITE_API_BASE i Render til din API-URL.",
    queueCount: "Offline-kø: {count}",
    queueEmpty: "Køen er tom.",
    syncing: "Synkroniserer...",
    syncDone: "Synk færdig. API-svar: {response}",
    syncFailed: "Synk mislykkedes: {message}",
    queued: "Lagde hændelse i offline-kø: {eventId}"
  },
  sv: {
    appTitle: "PowerRegister (demo)",
    appSubtitle: "Web-PWA som simulerar Android-app: QR/serial + offline-kö + batch-synk.",
    deviceRefLabel: "DeviceRef (QR eller Serial)",
    noteLabel: "Notering",
    installYearLabel: "Installationsår",
    lastServiceYearLabel: "Senaste serviceår",
    contactNameLabel: "Kontakt - namn",
    contactEmailLabel: "Kontakt - email",
    installYearPlaceholder: "t.ex. 2020",
    lastServiceYearPlaceholder: "t.ex. 2023",
    queueButton: "Lägg i offline-kö",
    syncButton: "Synka nu (batch)",
    localhostWarning: "API_BASE pekar på localhost ({apiBase}). Sätt VITE_API_BASE i Render till din API-URL.",
    queueCount: "Offline-kö: {count}",
    queueEmpty: "Kön är tom.",
    syncing: "Synkar...",
    syncDone: "Synk klar. API-svar: {response}",
    syncFailed: "Synk misslyckades: {message}",
    queued: "Lade event i offline-kö: {eventId}"
  }
};

type I18nContextValue = {
  language: LanguageCode;
  locale: string;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLanguage(): LanguageCode {
  if (typeof window === "undefined") return "sv";

  const stored = window.localStorage.getItem(storageKey) as LanguageCode | null;
  if (stored && stored in translations) return stored;

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("fi")) return "fi";
  if (browser.startsWith("nb") || browser.startsWith("nn") || browser.startsWith("no")) return "no";
  if (browser.startsWith("da")) return "dk";
  if (browser.startsWith("en")) return "en";
  return "sv";
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(detectLanguage);

  useEffect(() => {
    window.localStorage.setItem(storageKey, language);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: localeByLanguage[language],
    setLanguage,
    t: (key, params) => interpolate(translations[language][key] ?? translations.sv[key] ?? key, params)
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
