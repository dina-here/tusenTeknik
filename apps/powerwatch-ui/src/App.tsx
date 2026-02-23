import { useMemo, useState } from "react";
import { enqueue, loadQueue, clearQueue, type OfflineEvent } from "./offlineQueue";
import { API_BASE, postBatch } from "./api";

export function App() {
  const [deviceRef, setDeviceRef] = useState("QR-NEO-0001");
  const [note, setNote] = useState("");
  const [installYear, setInstallYear] = useState<string>("");
  const [lastServiceYear, setLastServiceYear] = useState<string>("");
  const [name, setName] = useState("Fastighetsskötare");
  const [email, setEmail] = useState("skotare@solglantan.se");
  const [status, setStatus] = useState<string>("");

  const queue = useMemo(() => loadQueue(), [status]);

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
    setStatus(`Lade event i offline-kö: ${evt.eventId}`);
  }

  async function sync() {
    const q = loadQueue();
    if (q.length === 0) {
      setStatus("Kön är tom.");
      return;
    }
    try {
      setStatus("Synkar...");
      const res = await postBatch(q);
      clearQueue();
      setStatus(`Synk klar. API-svar: ${JSON.stringify(res)}`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setStatus(`Synk misslyckades: ${msg}`);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">PowerWatch (demo)</h1>
        <p className="text-slate-600 mt-1">
          Web-PWA som simulerar Android-app: QR/serial + offline-kö + batch-synk.
        </p>

        <div className="mt-6 card p-5 space-y-4">
          <Field label="DeviceRef (QR eller Serial)">
            <input className="input"
              value={deviceRef} onChange={(e) => setDeviceRef(e.target.value)} />
          </Field>

          <Field label="Notering">
            <input className="input"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Installationsår">
              <input
                className="input"
                placeholder="t.ex. 2020"
                value={installYear}
                onChange={(e) => setInstallYear(e.target.value)}
              />
            </Field>
            <Field label="Senaste serviceår">
              <input
                className="input"
                placeholder="t.ex. 2023"
                value={lastServiceYear}
                onChange={(e) => setLastServiceYear(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kontakt - namn">
              <input className="input"
                value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Kontakt - email">
              <input className="input"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button onClick={addToQueue} className="btn btn-primary">
              Lägg i offline-kö
            </button>
            <button onClick={sync} className="btn btn-ghost">
              Synka nu (batch)
            </button>
          </div>

          {API_BASE.includes("localhost") && !location.hostname.includes("localhost") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              API_BASE pekar på localhost ({API_BASE}). Sätt VITE_API_BASE i Render till din API-URL.
            </div>
          )}

          <div className="text-sm text-slate-600">
            Offline-kö: <span className="font-medium text-slate-900">{queue.length}</span>
          </div>

          {status && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {status}
            </div>
          )}
        </div>
      </div>
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
