import { useMemo, useState } from "react";
import { enqueue, loadQueue, clearQueue, type OfflineEvent } from "./offlineQueue";
import { postBatch } from "./api";

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
    const res = await postBatch(q);
    clearQueue();
    setStatus(`Synk klar. API-svar: ${JSON.stringify(res)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-slate-900">PowerWatch (demo)</h1>
        <p className="text-slate-600 mt-1">
          Web-PWA som simulerar Android-app: QR/serial + offline-kö + batch-synk.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <Field label="DeviceRef (QR eller Serial)">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={deviceRef} onChange={(e) => setDeviceRef(e.target.value)} />
          </Field>

          <Field label="Notering">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Installationsår">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="t.ex. 2020"
                value={installYear}
                onChange={(e) => setInstallYear(e.target.value)}
              />
            </Field>
            <Field label="Senaste serviceår">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="t.ex. 2023"
                value={lastServiceYear}
                onChange={(e) => setLastServiceYear(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kontakt - namn">
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Kontakt - email">
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button onClick={addToQueue} className="rounded-xl px-4 py-2 bg-slate-900 text-white">
              Lägg i offline-kö
            </button>
            <button onClick={sync} className="rounded-xl px-4 py-2 border border-slate-200 bg-white">
              Synka nu (batch)
            </button>
          </div>

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
