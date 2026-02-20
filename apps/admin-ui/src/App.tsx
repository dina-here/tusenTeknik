import { useEffect, useState } from "react";
import { apiGet } from "./api/client";

type IngressEvent = { id: string; deviceRef: string; status: string; receivedAt: string; eventId: string };
type Device = { id: string; serialNumber: string; qrCodeId: string; status: string; model: { sku: string; displayName: string } };

export function App() {
  const [tab, setTab] = useState<"inbox" | "devices">("inbox");

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar tab={tab} setTab={setTab} />
      {tab === "inbox" ? <Inbox /> : <Devices />}
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

  useEffect(() => {
    apiGet<IngressEvent[]>("/api/admin/inbox")
      .then(setItems)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <Page title="Inbox" subtitle="Inkomna PowerWatch-events (staging). Workern processar dessa asynkront.">
      {err && <ErrorBox text={err} />}
      <CardTable
        headers={["Tid", "DeviceRef", "Status", "EventId"]}
        rows={items.map((x) => [
          new Date(x.receivedAt).toLocaleString(),
          x.deviceRef,
          <StatusBadge key={x.id} status={x.status} />,
          <span className="text-slate-500" key={x.eventId}>{x.eventId}</span>
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
        headers={["Serial", "QR", "Model", "Status"]}
        rows={items.map((d) => [
          <span className="font-medium text-slate-900" key={d.id}>{d.serialNumber}</span>,
          <span className="text-slate-600" key={d.qrCodeId}>{d.qrCodeId}</span>,
          <span className="text-slate-700" key={d.model.sku}>{d.model.displayName}</span>,
          <StatusBadge key={d.status} status={d.status} />
        ])}
      />
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
