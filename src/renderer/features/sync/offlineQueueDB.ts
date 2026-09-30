const DB_NAME = 'b-chess-offline-queue';
const STORE_NAME = 'items';
const DB_VERSION = 1;

export interface QueuedItem {
  localId: string;
  kind: 'vsComputer' | 'milestone';
  transcript: unknown;
  playedAt: string; // ISO wall-clock time — informational only, never trusted alone (see localSeq)
  /** Monotonically increasing per-device counter, immune to system-clock changes — the server-side
   *  replacement for `playedAt` when detecting a suspiciously large offline-earning claim
   *  (Review Focus item 3; the actual rate-capping logic itself belongs to sub-project 2). */
  localSeq: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addItem(item: QueuedItem): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listItems(): Promise<QueuedItem[]> {
  const db = await openDB();
  const items = await new Promise<QueuedItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedItem[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function deleteItem(localId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
