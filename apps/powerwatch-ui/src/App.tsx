import { type ReactNode, useState } from "react";
import { enqueue, loadQueue, clearQueue, type OfflineEvent } from "./offlineQueue";
import { API_BASE, postBatch } from "./api";
import milleteknikLogo from "./assets/milleteknik-logo.svg";
import { languageOptions, useI18n } from "./i18n";

type StatusMessage =
  | { key: "queueEmpty" }
  | { key: "syncing" }
  | { key: "syncDone"; params: { response: string } }
  | { key: "syncFailed"; params: { message: string } }
  | { key: "queued"; params: { eventId: string } };

export function App() {
  const { t } = useI18n();
  const [deviceRef, setDeviceRef] = useState("QR-NEO-0001");
  const [note, setNote] = useState("");
  const [installYear, setInstallYear] = useState<string>("");
  const [lastServiceYear, setLastServiceYear] = useState<string>("");
  const [name, setName] = useState("Fastighetsskötare");
  const [email, setEmail] = useState("skotare@solglantan.se");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const queue = loadQueue();

  async function addToQueue() {
    const parsedInstallYear = installYear.trim() ? Number(installYear) : undefined;
    const parsedServiceYear = lastServiceYear.trim() ? Number(lastServiceYear) : undefined;
    const evt: OfflineEvent = {
      eventId: crypto.randomUUID(),
      source: "POWERWATCH",
      deviceRef: deviceRef.trim(),
      timestamp: new Date().toISOString(),
      payload: {
        note,
        installYear: Number.isFinite(parsedInstallYear) ? parsedInstallYear : undefined,
        lastServiceYear: Number.isFinite(parsedServiceYear) ? parsedServiceYear : undefined
      },
      contact: { name, email }
    };
    enqueue(evt);
    setStatus({ key: "queued", params: { eventId: evt.eventId } });
  }

  async function sync() {
    const q = loadQueue();
    if (q.length === 0) {
      setStatus({ key: "queueEmpty" });
      return;
    }
    try {
      setStatus({ key: "syncing" });
      const res = await postBatch(q);
      clearQueue();
      setStatus({ key: "syncDone", params: { response: JSON.stringify(res) } });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setStatus({ key: "syncFailed", params: { message: msg } });
    }
  }

  return (
    <div className="min-h-screen bg-white text-millet-text">
      <div className="border-b border-millet-border bg-white">
        <div className="max-w-millet mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <img
              src={milleteknikLogo}
              alt="Milleteknik"
              className="h-10 w-auto object-contain sm:h-12"
            />
            <div>
              <h1 className="text-2xl font-semibold text-millet-text">{t("appTitle")}</h1>
              <p className="text-millet-muted mt-1">
                {t("appSubtitle")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="max-w-millet mx-auto p-4 sm:p-6">
        <div className="mt-6 card p-5 space-y-4">
          <Field label={t("deviceRefLabel")}>
            <input className="input"
              value={deviceRef} onChange={(e) => setDeviceRef(e.target.value)} />
          </Field>

          <Field label={t("noteLabel")}>
            <input className="input"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("installYearLabel")}>
              <input
                className="input"
                placeholder={t("installYearPlaceholder")}
                value={installYear}
                onChange={(e) => setInstallYear(e.target.value)}
              />
            </Field>
            <Field label={t("lastServiceYearLabel")}>
              <input
                className="input"
                placeholder={t("lastServiceYearPlaceholder")}
                value={lastServiceYear}
                onChange={(e) => setLastServiceYear(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("contactNameLabel")}>
              <input className="input"
                value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("contactEmailLabel")}>
              <input className="input"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button onClick={addToQueue} className="btn btn-primary">
              {t("queueButton")}
            </button>
            <button onClick={sync} className="btn btn-ghost">
              {t("syncButton")}
            </button>
          </div>

          {API_BASE.includes("localhost") && !location.hostname.includes("localhost") && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              {t("localhostWarning", { apiBase: API_BASE })}
            </div>
          )}

          <div className="text-sm text-millet-muted">
            {t("queueCount", { count: queue.length })}
          </div>

          {status && (
            <div className="rounded-lg border border-millet-border bg-millet-surface p-3 text-sm text-millet-text">
              {t(status.key, "params" in status ? status.params : undefined)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-1 sm:justify-end">
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          className={["btn text-xs px-2 py-1 min-h-0", language === option.code ? "btn-primary" : "btn-ghost"].join(" ")}
          aria-pressed={language === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-millet-text mb-1">{label}</div>
      {children}
    </label>
  );
}
