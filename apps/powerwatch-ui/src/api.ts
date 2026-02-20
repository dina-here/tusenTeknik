export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export async function postBatch(events: any[]) {
  const res = await fetch(`${API_BASE}/api/powerwatch/events/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
