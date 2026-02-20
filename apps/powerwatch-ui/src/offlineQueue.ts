/**
 * Offline-kö i localStorage.
 * - I Android är detta typiskt SQLite/Room.
 * - I demo räcker localStorage: lätt att visa och förstå.
 *
 * Viktigt: eventId är UUID => backend dedupe via UNIQUE(eventId).
 */
export type OfflineEvent = {
  eventId: string;
  source: "POWERWATCH";
  deviceRef: string;
  timestamp: string;
  payload: { note?: string; reportedProblem?: string };
  contact?: { name: string; email?: string; phone?: string; role?: string };
};

const KEY = "pw_offline_queue_v1";

export function loadQueue(): OfflineEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveQueue(items: OfflineEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueue(evt: OfflineEvent) {
  const q = loadQueue();
  q.push(evt);
  saveQueue(q);
}

export function clearQueue() {
  saveQueue([]);
}
