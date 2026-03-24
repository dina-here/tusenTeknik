import { useEffect, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import { apiGet, apiPost, API_BASE } from "./api/client";
import milleteknikLogo from "./assets/milleteknik-logo.svg";
import { languageOptions, useI18n, type LanguageCode } from "./i18n";
import { PowerwatchAnalysisPanel } from "./powerwatch/PowerwatchAnalysisPanel";

type IngressEvent = { id: string; deviceRef: string; status: string; receivedAt: string; eventId: string };
type Device = {
  id: string;
  serialNumber: string;
  qrCodeId: string;
  status: string;
  installDate?: string | null;
  model: { sku: string; displayName: string; expectedLifetimeMonths?: number | null };
  site?: { name?: string | null; customer?: { name?: string | null } | null } | null;
  serviceHistory?: { serviceDate: string; action: string; notes?: string | null }[];
};
type Recommendation = {
  id: string;
  type: string;
  reason: string;
  status: string;
  createdAt: string;
  device: { qrCodeId: string; serialNumber: string; model: { displayName: string } };
};
type ServiceEntry = {
  id: string;
  serviceDate: string;
  action: string;
  notes?: string | null;
  device: { qrCodeId: string; serialNumber: string; model: { displayName: string }; site?: { customer?: { name?: string | null } | null } | null };
};

type SizingResult = {
  sizingRequestId: string;
  recommendedModelSku: string;
  batteryCapacityAh: number;
  safetyMargin: number;
  algorithmVersion: string;
};

type TabKey = "inbox" | "devices" | "recommendations" | "powerwatch" | "sizing" | "service";
type RowStatusKey = "chooseDeviceStatus" | "mergedStatus" | "createdStatus";

export function App() {
  const [tab, setTab] = useState<TabKey>("inbox");

  return (
    <div className="min-h-screen">
      <Topbar tab={tab} setTab={setTab} />
      {tab === "inbox" && <Inbox />}
      {tab === "devices" && <Devices />}
      {tab === "recommendations" && <Recommendations />}
      {tab === "powerwatch" && <Powerwatch />}
      {tab === "sizing" && <SizingTool />}
      {tab === "service" && <ServiceHistory />}
    </div>
  );
}

function Topbar({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const { t } = useI18n();

  return (
    <div className="border-b border-millet-border bg-white">
      <div className="max-w-millet mx-auto px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={milleteknikLogo}
            alt="Milleteknik"
            className="h-10 w-auto object-contain sm:h-12"
          />
          <div>
            <div className="text-lg font-semibold text-millet-text">{t("appTitle")}</div>
            <div className="text-sm text-millet-muted">{t("appSubtitle")}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <NavButton active={tab === "inbox"} onClick={() => setTab("inbox")}>{t("inbox")}</NavButton>
          <NavButton active={tab === "devices"} onClick={() => setTab("devices")}>{t("devices")}</NavButton>
          <NavButton active={tab === "recommendations"} onClick={() => setTab("recommendations")}>{t("recommendations")}</NavButton>
          <NavButton active={tab === "powerwatch"} onClick={() => setTab("powerwatch")}>{t("powerwatch")}</NavButton>
          <NavButton active={tab === "sizing"} onClick={() => setTab("sizing")}>{t("sizing")}</NavButton>
          <NavButton active={tab === "service"} onClick={() => setTab("service")}>{t("service")}</NavButton>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-1 sm:ml-2">
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

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "btn text-sm",
        active ? "btn-primary" : "btn-ghost"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Inbox() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<IngressEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, RowStatusKey>>({});

  // Auto-refresh inbox every 5 seconds
  useEffect(() => {
    const fetchInbox = () => {
      apiGet<IngressEvent[]>("/api/admin/inbox")
        .then(setItems)
        .catch((e) => setErr(String(e)));
    };

    fetchInbox(); // Initial fetch
    const interval = setInterval(fetchInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh devices every 5 seconds
  useEffect(() => {
    const fetchDevices = () => {
      apiGet<Device[]>("/api/admin/devices")
        .then((list) => {
          setDevices(list);
          if (list.length > 0) {
            const defaults: Record<string, string> = {};
            items.forEach((i) => {
              defaults[i.id] = list[0].id;
            });
            setSelection((prev) => ({ ...defaults, ...prev }));
          }
        })
        .catch((e) => setErr(String(e)));
    };

    fetchDevices(); // Initial fetch
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  async function refresh() {
    const list = await apiGet<IngressEvent[]>("/api/admin/inbox");
    setItems(list);
  }

  async function mergeItem(id: string) {
    const deviceId = selection[id];
    if (!deviceId) return setStatus((s) => ({ ...s, [id]: "chooseDeviceStatus" }));
    await apiPost(`/api/admin/inbox/${id}/resolve`, { action: "merge", deviceId });
    setStatus((s) => ({ ...s, [id]: "mergedStatus" }));
    await refresh();
  }

  async function createItem(id: string) {
    await apiPost(`/api/admin/inbox/${id}/resolve`, { action: "create" });
    setStatus((s) => ({ ...s, [id]: "createdStatus" }));
    await refresh();
  }

  return (
    <Page title={t("inboxTitle")} subtitle={t("inboxSubtitle")}>
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={[t("time"), t("deviceRef"), t("status"), t("eventId"), t("merge"), t("create")]}
        rows={items.map((x) => [
          new Date(x.receivedAt).toLocaleString(locale),
          x.deviceRef,
          <StatusBadge key={x.id} status={x.status} />,
          <span className="text-millet-muted" key={x.eventId}>{x.eventId}</span>,
          <div className="flex items-center gap-2" key={`${x.id}-merge`}>
            <select
              className="input text-xs py-1"
              value={selection[x.id] ?? ""}
              onChange={(e) => setSelection((s) => ({ ...s, [x.id]: e.target.value }))}
            >
              <option value="" disabled>{t("selectDevice")}</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.serialNumber} / {d.qrCodeId}</option>
              ))}
            </select>
            <button onClick={() => mergeItem(x.id)} className="btn btn-primary text-xs px-2 py-1">{t("merge")}</button>
          </div>,
          <div className="flex items-center gap-2" key={`${x.id}-create`}>
            <button onClick={() => createItem(x.id)} className="btn btn-ghost text-xs px-2 py-1">{t("createNew")}</button>
            {status[x.id] && <span className="text-xs text-millet-muted">{t(status[x.id])}</span>}
          </div>
        ])}
      />
    </Page>
  );
}

function Devices() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<Device[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Auto-refresh devices every 5 seconds
  useEffect(() => {
    const fetchDevices = () => {
      apiGet<Device[]>("/api/admin/devices")
        .then(setItems)
        .catch((e) => setErr(String(e)));
    };

    fetchDevices(); // Initial fetch
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Page title={t("devicesTitle")} subtitle={t("devicesSubtitle")}>
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={[t("serial"), t("qr"), t("model"), t("customer"), t("site"), t("install"), t("lastService"), t("status")]}
        rows={items.map((d) => [
          <span className="font-medium text-millet-text" key={d.id}>{d.serialNumber}</span>,
          <span className="text-millet-muted" key={d.qrCodeId}>{d.qrCodeId}</span>,
          <span className="text-millet-text" key={d.model.sku}>{d.model.displayName}</span>,
          <span className="text-millet-text" key={`${d.id}-cust`}>{d.site?.customer?.name ?? "-"}</span>,
          <span className="text-millet-text" key={`${d.id}-site`}>{d.site?.name ?? "-"}</span>,
          <span className="text-millet-text" key={`${d.id}-install`}>
            {d.installDate ? new Date(d.installDate).toLocaleDateString(locale) : "-"}
          </span>,
          <span className="text-millet-text" key={`${d.id}-service`}>
            {d.serviceHistory?.[0]?.serviceDate ? new Date(d.serviceHistory[0].serviceDate).toLocaleDateString(locale) : "-"}
          </span>,
          <StatusBadge key={d.status} status={d.status} />
        ])}
      />
    </Page>
  );
}

function Recommendations() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Auto-refresh recommendations every 5 seconds
  useEffect(() => {
    const fetchRecommendations = () => {
      apiGet<Recommendation[]>("/api/admin/recommendations")
        .then(setItems)
        .catch((e) => setErr(String(e)));
    };

    fetchRecommendations(); // Initial fetch
    const interval = setInterval(fetchRecommendations, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Page title={t("recommendationsTitle")} subtitle={t("recommendationsSubtitle")}>
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={[t("time"), t("device"), t("model"), t("type"), t("status"), t("reason")]}
        rows={items.map((r) => [
          new Date(r.createdAt).toLocaleString(locale),
          <span className="font-medium text-millet-text" key={r.id}>{r.device.qrCodeId || r.device.serialNumber}</span>,
          <span className="text-millet-text" key={`${r.id}-model`}>{r.device.model.displayName}</span>,
          <span className="text-millet-text" key={`${r.id}-type`}>{r.type}</span>,
          <StatusBadge key={`${r.id}-status`} status={r.status ?? "NEW"} />,
          <span className="text-millet-muted" key={`${r.id}-reason`}>{r.reason}</span>
        ])}
      />
    </Page>
  );
}

function Powerwatch() {
  const { t } = useI18n();

  return (
    <Page title={t("powerwatchPageTitle")} subtitle={t("powerwatchPageSubtitle")}>
      <PowerwatchAnalysisPanel />
    </Page>
  );
}

function ServiceHistory() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<ServiceEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Auto-refresh service history every 10 seconds
  useEffect(() => {
    const fetchServiceHistory = () => {
      apiGet<ServiceEntry[]>("/api/admin/service-history")
        .then(setItems)
        .catch((e) => setErr(String(e)));
    };

    fetchServiceHistory(); // Initial fetch
    const interval = setInterval(fetchServiceHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Page title={t("serviceTitle")} subtitle={t("serviceSubtitle")}>
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={[t("time"), t("device"), t("model"), t("customer"), t("action"), t("notes")]}
        rows={items.map((s) => [
          new Date(s.serviceDate).toLocaleDateString(locale),
          <span className="font-medium text-millet-text" key={s.id}>{s.device.qrCodeId || s.device.serialNumber}</span>,
          <span className="text-millet-text" key={`${s.id}-model`}>{s.device.model.displayName}</span>,
          <span className="text-millet-text" key={`${s.id}-cust`}>{s.device.site?.customer?.name ?? "-"}</span>,
          <span className="text-millet-text" key={`${s.id}-action`}>{s.action}</span>,
          <span className="text-millet-muted" key={`${s.id}-notes`}>{s.notes ?? "-"}</span>
        ])}
      />
    </Page>
  );
}

function SizingTool() {
  const { t, locale } = useI18n();
  const [load, setLoad] = useState("1.5");
  const [backupHours, setBackupHours] = useState("4");
  const [temperature, setTemperature] = useState("20");
  const [result, setResult] = useState<SizingResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setResult(null);
    try {
      const payload = {
        load: Number(load),
        backupHours: Number(backupHours),
        temperature: Number(temperature)
      };
      const res = await apiPost<SizingResult>("/api/sizing", payload);
      setResult(res);
    } catch (e: any) {
      setErr(String(e));
    }
  }

  function savePdf() {
    if (!result) return;

    const generatedAt = new Date();
    const generatedAtText = generatedAt.toLocaleString(locale);
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t("sizingReportTitle"), 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`${t("reportDate")}: ${generatedAtText}`, 40, 75);

    doc.setFont("helvetica", "bold");
    doc.text("Input", 40, 105);
    doc.setFont("helvetica", "normal");
    doc.text(`${t("loadKw")}: ${load}`, 40, 125);
    doc.text(`${t("backupHours")}: ${backupHours}`, 40, 145);
    doc.text(`${t("temperatureC")}: ${temperature}`, 40, 165);

    doc.setFont("helvetica", "bold");
    doc.text("Result", 40, 200);
    doc.setFont("helvetica", "normal");
    doc.text(`sizingRequestId: ${result.sizingRequestId}`, 40, 220);
    doc.text(`recommendedModelSku: ${result.recommendedModelSku}`, 40, 240);
    doc.text(`batteryCapacityAh: ${result.batteryCapacityAh}`, 40, 260);
    doc.text(`safetyMargin: ${result.safetyMargin}`, 40, 280);
    doc.text(`algorithmVersion: ${result.algorithmVersion}`, 40, 300);

    const fileDate = generatedAt.toISOString().slice(0, 10);
    doc.save(`sizing-report-${fileDate}.pdf`);
  }

  return (
    <Page title={t("sizingTitle")} subtitle={t("sizingSubtitle")}>
      {err && <ErrorBox text={err} />}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={t("loadKw")}>
            <input className="input" value={load} onChange={(e) => setLoad(e.target.value)} />
          </Field>
          <Field label={t("backupHours")}>
            <input className="input" value={backupHours} onChange={(e) => setBackupHours(e.target.value)} />
          </Field>
          <Field label={t("temperatureC")}>
            <input className="input" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={submit} className="btn btn-primary">{t("calculate")}</button>
          {result && (
            <button onClick={savePdf} className="btn btn-ghost">{t("savePdf")}</button>
          )}
        </div>
        {result && (
          <pre className="text-sm rounded-lg border border-millet-border bg-millet-surface p-3 overflow-auto text-millet-text">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </Page>
  );
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="max-w-millet mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-millet-text">{title}</h1>
      <p className="text-millet-muted mt-1">{subtitle}</p>
      <div className="mt-6">{children}</div>
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

function CardTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-[560px] sm:min-w-[720px] w-full text-xs sm:text-sm text-millet-text">
        <thead className="bg-millet-surface text-millet-text">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left font-medium p-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-millet-border/70">
              {r.map((cell, cidx) => (
                <td key={cidx} className="p-3 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  const { t } = useI18n();
  const isFetchError = text.toLowerCase().includes("failed to fetch");
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div>{text}</div>
      {isFetchError && (
        <div className="mt-1 text-xs text-amber-900/80">
          {t("apiUnavailable", { apiBase: API_BASE })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
  if (status === "ACCEPTED") return <span className={`${base} bg-millet-surface border-millet-border text-millet-text`}>{t("accepted")}</span>;
  if (status === "REJECTED") return <span className={`${base} bg-red-50 border-red-200 text-red-800`}>{t("rejected")}</span>;
  if (status === "PROCESSING") return <span className={`${base} bg-yellow-50 border-yellow-300 text-yellow-900`}>{t("processing")}</span>;
  if (status === "NEW") return <span className={`${base} bg-millet-surface border-millet-border text-millet-muted`}>{t("new")}</span>;
  return <span className={`${base} bg-millet-surface border-millet-border text-millet-muted`}>{status}</span>;
}
