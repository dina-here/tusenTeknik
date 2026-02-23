import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api/client";

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

export function App() {
  const [tab, setTab] = useState<"inbox" | "devices" | "recommendations" | "sizing" | "service">("inbox");

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar tab={tab} setTab={setTab} />
      {tab === "inbox" && <Inbox />}
      {tab === "devices" && <Devices />}
      {tab === "recommendations" && <Recommendations />}
      {tab === "sizing" && <SizingTool />}
      {tab === "service" && <ServiceHistory />}
    </div>
  );
}

function Topbar({ tab, setTab }: { tab: string; setTab: (t: any) => void }) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">PowerAdmin (demo)</div>
          <div className="text-sm text-slate-600">Inbox, Devices, Recommendations, Telemetry</div>
        </div>
        <div className="flex gap-2">
          <NavButton active={tab === "inbox"} onClick={() => setTab("inbox")}>Inbox</NavButton>
          <NavButton active={tab === "devices"} onClick={() => setTab("devices")}>Devices</NavButton>
          <NavButton active={tab === "recommendations"} onClick={() => setTab("recommendations")}>Recommendations</NavButton>
          <NavButton active={tab === "sizing"} onClick={() => setTab("sizing")}>Sizing</NavButton>
          <NavButton active={tab === "service"} onClick={() => setTab("service")}>Service</NavButton>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-2 text-sm border transition",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Inbox() {
  const [items, setItems] = useState<IngressEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<IngressEvent[]>("/api/admin/inbox")
      .then(setItems)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const list = await apiGet<IngressEvent[]>("/api/admin/inbox");
    setItems(list);
  }

  async function mergeItem(id: string) {
    const deviceId = selection[id];
    if (!deviceId) return setStatus((s) => ({ ...s, [id]: "Välj en enhet" }));
    await apiPost(`/api/admin/inbox/${id}/resolve`, { action: "merge", deviceId });
    setStatus((s) => ({ ...s, [id]: "Merged" }));
    await refresh();
  }

  async function createItem(id: string) {
    await apiPost(`/api/admin/inbox/${id}/resolve`, { action: "create" });
    setStatus((s) => ({ ...s, [id]: "Skapad" }));
    await refresh();
  }

  return (
    <Page title="Inbox" subtitle="Inkomna PowerWatch-events (staging). Workern processar dessa asynkront.">
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={["Tid", "DeviceRef", "Status", "EventId", "Merge", "Create"]}
        rows={items.map((x) => [
          new Date(x.receivedAt).toLocaleString(),
          x.deviceRef,
          <StatusBadge key={x.id} status={x.status} />,
          <span className="text-slate-500" key={x.eventId}>{x.eventId}</span>,
          <div className="flex items-center gap-2" key={`${x.id}-merge`}>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={selection[x.id] ?? ""}
              onChange={(e) => setSelection((s) => ({ ...s, [x.id]: e.target.value }))}
            >
              <option value="" disabled>Välj device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.serialNumber} / {d.qrCodeId}</option>
              ))}
            </select>
            <button onClick={() => mergeItem(x.id)} className="rounded-lg px-2 py-1 text-xs bg-slate-900 text-white">Merge</button>
          </div>,
          <div className="flex items-center gap-2" key={`${x.id}-create`}>
            <button onClick={() => createItem(x.id)} className="rounded-lg px-2 py-1 text-xs border border-slate-200">Skapa ny</button>
            {status[x.id] && <span className="text-xs text-slate-600">{status[x.id]}</span>}
          </div>
        ])}
      />
    </Page>
  );
}

function Devices() {
  const [items, setItems] = useState<Device[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Device[]>("/api/admin/devices")
      .then(setItems)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <Page title="Devices" subtitle="Enhetslista med modell och status. (Detaljvy kan byggas som nästa steg.)">
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={["Serial", "QR", "Model", "Customer", "Site", "Install", "Last Service", "Status"]}
        rows={items.map((d) => [
          <span className="font-medium text-slate-900" key={d.id}>{d.serialNumber}</span>,
          <span className="text-slate-600" key={d.qrCodeId}>{d.qrCodeId}</span>,
          <span className="text-slate-700" key={d.model.sku}>{d.model.displayName}</span>,
          <span className="text-slate-700" key={`${d.id}-cust`}>{d.site?.customer?.name ?? "-"}</span>,
          <span className="text-slate-700" key={`${d.id}-site`}>{d.site?.name ?? "-"}</span>,
          <span className="text-slate-700" key={`${d.id}-install`}>
            {d.installDate ? new Date(d.installDate).toLocaleDateString() : "-"}
          </span>,
          <span className="text-slate-700" key={`${d.id}-service`}>
            {d.serviceHistory?.[0]?.serviceDate ? new Date(d.serviceHistory[0].serviceDate).toLocaleDateString() : "-"}
          </span>,
          <StatusBadge key={d.status} status={d.status} />
        ])}
      />
    </Page>
  );
}

function Recommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Recommendation[]>("/api/admin/recommendations")
      .then(setItems)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <Page title="Recommendations" subtitle="Senaste rekommendationer från workern.">
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={["Tid", "Device", "Model", "Type", "Status", "Reason"]}
        rows={items.map((r) => [
          new Date(r.createdAt).toLocaleString(),
          <span className="font-medium text-slate-900" key={r.id}>{r.device.qrCodeId || r.device.serialNumber}</span>,
          <span className="text-slate-700" key={`${r.id}-model`}>{r.device.model.displayName}</span>,
          <span className="text-slate-700" key={`${r.id}-type`}>{r.type}</span>,
          <StatusBadge key={`${r.id}-status`} status={r.status ?? "NEW"} />,
          <span className="text-slate-600" key={`${r.id}-reason`}>{r.reason}</span>
        ])}
      />
    </Page>
  );
}

function ServiceHistory() {
  const [items, setItems] = useState<ServiceEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ServiceEntry[]>("/api/admin/service-history")
      .then(setItems)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <Page title="Service" subtitle="Servicehistorik per device (senaste 200).">
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={["Tid", "Device", "Model", "Customer", "Action", "Notes"]}
        rows={items.map((s) => [
          new Date(s.serviceDate).toLocaleDateString(),
          <span className="font-medium text-slate-900" key={s.id}>{s.device.qrCodeId || s.device.serialNumber}</span>,
          <span className="text-slate-700" key={`${s.id}-model`}>{s.device.model.displayName}</span>,
          <span className="text-slate-700" key={`${s.id}-cust`}>{s.device.site?.customer?.name ?? "-"}</span>,
          <span className="text-slate-700" key={`${s.id}-action`}>{s.action}</span>,
          <span className="text-slate-600" key={`${s.id}-notes`}>{s.notes ?? "-"}</span>
        ])}
      />
    </Page>
  );
}

function SizingTool() {
  const [load, setLoad] = useState("1.5");
  const [backupHours, setBackupHours] = useState("4");
  const [temperature, setTemperature] = useState("20");
  const [result, setResult] = useState<any>(null);
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
      const res = await apiPost<any>("/api/sizing", payload);
      setResult(res);
    } catch (e: any) {
      setErr(String(e));
    }
  }

  return (
    <Page title="Sizing" subtitle="Enkel dimensionering (demo).">
      {err && <ErrorBox text={err} />}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Load (kW)">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={load} onChange={(e) => setLoad(e.target.value)} />
          </Field>
          <Field label="Backup hours">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={backupHours} onChange={(e) => setBackupHours(e.target.value)} />
          </Field>
          <Field label="Temperature (°C)">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </Field>
        </div>
        <button onClick={submit} className="rounded-xl px-4 py-2 bg-slate-900 text-white">Beräkna</button>
        {result && (
          <pre className="text-sm rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </Page>
  );
}

function Page({ title, subtitle, children }: any) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="text-slate-600 mt-1">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="block">
      <div className="text-sm text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

function CardTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left font-medium p-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-100">
              {r.map((cell, cidx) => (
                <td key={cidx} className="p-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
  if (status === "ACCEPTED") return <span className={`${base} bg-slate-50 border-slate-200 text-slate-800`}>ACCEPTED</span>;
  if (status === "REJECTED") return <span className={`${base} bg-red-50 border-red-200 text-red-800`}>REJECTED</span>;
  if (status === "PROCESSING") return <span className={`${base} bg-amber-50 border-amber-200 text-amber-800`}>PROCESSING</span>;
  return <span className={`${base} bg-slate-50 border-slate-200 text-slate-700`}>{status}</span>;
}
