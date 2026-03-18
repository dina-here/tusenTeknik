import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LanguageCode = "en" | "fi" | "no" | "dk" | "sv";

export const languageOptions: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fi", label: "FI" },
  { code: "no", label: "NO" },
  { code: "dk", label: "DK" },
  { code: "sv", label: "SV" }
];

const storageKey = "milleteknik.admin-ui.language";

const localeByLanguage: Record<LanguageCode, string> = {
  en: "en-GB",
  fi: "fi-FI",
  no: "nb-NO",
  dk: "da-DK",
  sv: "sv-SE"
};

const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    appTitle: "PowerAdmin (demo)",
    appSubtitle: "Inbox, Devices, Recommendations, Telemetry",
    inbox: "Inbox",
    devices: "Devices",
    recommendations: "Recommendations",
    sizing: "Sizing",
    service: "Service",
    inboxTitle: "Inbox",
    inboxSubtitle: "Incoming PowerRegister events (staging). The worker processes them asynchronously.",
    devicesTitle: "Devices",
    devicesSubtitle: "Device list with model and status. (Detailed view can be added next.)",
    recommendationsTitle: "Recommendations",
    recommendationsSubtitle: "Latest recommendations from the worker.",
    serviceTitle: "Service",
    serviceSubtitle: "Service history per device (latest 200).",
    sizingTitle: "Sizing",
    sizingSubtitle: "Simple sizing tool (demo).",
    time: "Time",
    deviceRef: "DeviceRef",
    status: "Status",
    eventId: "EventId",
    merge: "Merge",
    create: "Create",
    device: "Device",
    model: "Model",
    customer: "Customer",
    site: "Site",
    install: "Install",
    lastService: "Last Service",
    serial: "Serial",
    qr: "QR",
    type: "Type",
    reason: "Reason",
    action: "Action",
    notes: "Notes",
    selectDevice: "Select device",
    createNew: "Create new",
    chooseDeviceStatus: "Select a device",
    mergedStatus: "Merged",
    createdStatus: "Created",
    loadKw: "Load (kW)",
    backupHours: "Backup hours",
    temperatureC: "Temperature (°C)",
    calculate: "Calculate",
    savePdf: "Save as PDF",
    sizingReportTitle: "Sizing report",
    reportDate: "Date",
    apiUnavailable: "Cannot reach API: {apiBase}. Check that the API is running and that VITE_API_BASE is correct.",
    accepted: "Accepted",
    rejected: "Rejected",
    processing: "Processing",
    new: "New"
  },
  fi: {
    appTitle: "PowerAdmin (demo)",
    appSubtitle: "Saapuneet, laitteet, suositukset, telemetria",
    inbox: "Saapuneet",
    devices: "Laitteet",
    recommendations: "Suositukset",
    sizing: "Mitoitus",
    service: "Huolto",
    inboxTitle: "Saapuneet",
    inboxSubtitle: "Saapuvat PowerRegister-tapahtumat (staging). Työntekijä käsittelee ne asynkronisesti.",
    devicesTitle: "Laitteet",
    devicesSubtitle: "Laitelista mallin ja tilan kanssa. (Yksityiskohtainen näkymä voidaan lisätä seuraavaksi.)",
    recommendationsTitle: "Suositukset",
    recommendationsSubtitle: "Viimeisimmät suositukset työntekijältä.",
    serviceTitle: "Huolto",
    serviceSubtitle: "Huoltohistoria per laite (viimeiset 200).",
    sizingTitle: "Mitoitus",
    sizingSubtitle: "Yksinkertainen mitoitustyökalu (demo).",
    time: "Aika",
    deviceRef: "LaiteRef",
    status: "Tila",
    eventId: "TapahtumaId",
    merge: "Yhdistä",
    create: "Luo",
    device: "Laite",
    model: "Malli",
    customer: "Asiakas",
    site: "Kohde",
    install: "Asennus",
    lastService: "Viime huolto",
    serial: "Sarja",
    qr: "QR",
    type: "Tyyppi",
    reason: "Syy",
    action: "Toiminto",
    notes: "Muistiinpanot",
    selectDevice: "Valitse laite",
    createNew: "Luo uusi",
    chooseDeviceStatus: "Valitse laite",
    mergedStatus: "Yhdistetty",
    createdStatus: "Luotu",
    loadKw: "Kuorma (kW)",
    backupHours: "Varmuustunnit",
    temperatureC: "Lämpötila (°C)",
    calculate: "Laske",
    savePdf: "Tallenna PDF",
    sizingReportTitle: "Mitoitusraportti",
    reportDate: "Päivämäärä",
    apiUnavailable: "API:in tavoittaminen epäonnistui: {apiBase}. Tarkista, että API on käynnissä ja että VITE_API_BASE on oikein.",
    accepted: "Hyväksytty",
    rejected: "Hylätty",
    processing: "Käsitellään",
    new: "Uusi"
  },
  no: {
    appTitle: "PowerAdmin (demo)",
    appSubtitle: "Innboks, enheter, anbefalinger, telemetri",
    inbox: "Innboks",
    devices: "Enheter",
    recommendations: "Anbefalinger",
    sizing: "Dimensjonering",
    service: "Service",
    inboxTitle: "Innboks",
    inboxSubtitle: "Innkommende PowerRegister-hendelser (staging). Workeren behandler dem asynkront.",
    devicesTitle: "Enheter",
    devicesSubtitle: "Enhetsliste med modell og status. (Detaljvisning kan bygges som neste steg.)",
    recommendationsTitle: "Anbefalinger",
    recommendationsSubtitle: "Siste anbefalinger fra workeren.",
    serviceTitle: "Service",
    serviceSubtitle: "Servicehistorikk per enhet (siste 200).",
    sizingTitle: "Dimensjonering",
    sizingSubtitle: "Enkelt dimensjoneringsverktøy (demo).",
    time: "Tid",
    deviceRef: "DeviceRef",
    status: "Status",
    eventId: "HendelsesId",
    merge: "Slå sammen",
    create: "Opprett",
    device: "Enhet",
    model: "Modell",
    customer: "Kunde",
    site: "Sted",
    install: "Installasjon",
    lastService: "Siste service",
    serial: "Serienr",
    qr: "QR",
    type: "Type",
    reason: "Årsak",
    action: "Handling",
    notes: "Notater",
    selectDevice: "Velg enhet",
    createNew: "Opprett ny",
    chooseDeviceStatus: "Velg enhet",
    mergedStatus: "Slått sammen",
    createdStatus: "Opprettet",
    loadKw: "Last (kW)",
    backupHours: "Backup-timer",
    temperatureC: "Temperatur (°C)",
    calculate: "Beregn",
    savePdf: "Lagre som PDF",
    sizingReportTitle: "Dimensjoneringsrapport",
    reportDate: "Dato",
    apiUnavailable: "Kan ikke nå API: {apiBase}. Kontroller at API-et kjører og at VITE_API_BASE er riktig.",
    accepted: "Godkjent",
    rejected: "Avvist",
    processing: "Behandles",
    new: "Ny"
  },
  dk: {
    appTitle: "PowerAdmin (demo)",
    appSubtitle: "Indbakke, enheder, anbefalinger, telemetri",
    inbox: "Indbakke",
    devices: "Enheder",
    recommendations: "Anbefalinger",
    sizing: "Dimensionering",
    service: "Service",
    inboxTitle: "Indbakke",
    inboxSubtitle: "Indgående PowerRegister-hændelser (staging). Workeren behandler dem asynkront.",
    devicesTitle: "Enheder",
    devicesSubtitle: "Enhedsliste med model og status. (Detaljevisning kan bygges som næste trin.)",
    recommendationsTitle: "Anbefalinger",
    recommendationsSubtitle: "Seneste anbefalinger fra workeren.",
    serviceTitle: "Service",
    serviceSubtitle: "Servicehistorik pr. enhed (seneste 200).",
    sizingTitle: "Dimensionering",
    sizingSubtitle: "Enkelt dimensioneringsværktøj (demo).",
    time: "Tid",
    deviceRef: "DeviceRef",
    status: "Status",
    eventId: "HændelsesId",
    merge: "Flet",
    create: "Opret",
    device: "Enhed",
    model: "Model",
    customer: "Kunde",
    site: "Site",
    install: "Installation",
    lastService: "Seneste service",
    serial: "Serienr",
    qr: "QR",
    type: "Type",
    reason: "Årsag",
    action: "Handling",
    notes: "Noter",
    selectDevice: "Vælg enhed",
    createNew: "Opret ny",
    chooseDeviceStatus: "Vælg enhed",
    mergedStatus: "Flettet",
    createdStatus: "Oprettet",
    loadKw: "Belastning (kW)",
    backupHours: "Backup-timer",
    temperatureC: "Temperatur (°C)",
    calculate: "Beregn",
    savePdf: "Gem som PDF",
    sizingReportTitle: "Dimensioneringsrapport",
    reportDate: "Dato",
    apiUnavailable: "Kan ikke nå API: {apiBase}. Kontroller, at API'et kører, og at VITE_API_BASE er korrekt.",
    accepted: "Godkendt",
    rejected: "Afvist",
    processing: "Behandles",
    new: "Ny"
  },
  sv: {
    appTitle: "PowerAdmin (demo)",
    appSubtitle: "Inkorg, Enheter, Rekommendationer, Telemetri",
    inbox: "Inkorg",
    devices: "Enheter",
    recommendations: "Rekommendationer",
    sizing: "Dimensionering",
    service: "Service",
    inboxTitle: "Inkorg",
    inboxSubtitle: "Inkomna PowerRegister-events (staging). Workern processar dessa asynkront.",
    devicesTitle: "Enheter",
    devicesSubtitle: "Enhetslista med modell och status. (Detaljvy kan byggas som nästa steg.)",
    recommendationsTitle: "Rekommendationer",
    recommendationsSubtitle: "Senaste rekommendationer från workern.",
    serviceTitle: "Service",
    serviceSubtitle: "Servicehistorik per enhet (senaste 200).",
    sizingTitle: "Dimensionering",
    sizingSubtitle: "Enkel dimensionering (demo).",
    time: "Tid",
    deviceRef: "EnhetsRef",
    status: "Status",
    eventId: "EventId",
    merge: "Sammanfoga",
    create: "Skapa",
    device: "Enhet",
    model: "Modell",
    customer: "Kund",
    site: "Plats",
    install: "Installation",
    lastService: "Senaste service",
    serial: "Serienr.",
    qr: "QR",
    type: "Typ",
    reason: "Orsak",
    action: "Åtgärd",
    notes: "Anteckningar",
    selectDevice: "Välj enhet",
    createNew: "Skapa ny",
    chooseDeviceStatus: "Välj en enhet",
    mergedStatus: "Sammanfogad",
    createdStatus: "Skapad",
    loadKw: "Last (kW)",
    backupHours: "Backuptimmar",
    temperatureC: "Temperatur (°C)",
    calculate: "Beräkna",
    savePdf: "Spara i PDF",
    sizingReportTitle: "Dimensioneringsrapport",
    reportDate: "Datum",
    apiUnavailable: "Kan inte nå API: {apiBase}. Kontrollera att API:t kör och att VITE_API_BASE är rätt.",
    accepted: "Accepterad",
    rejected: "Avvisad",
    processing: "Bearbetas",
    new: "Ny"
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
