const DB_NAME = "motorclub-post-draft";
const STORE = "originals";

function keyFor(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraftOriginal(userId: string, itemId: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, keyFor(userId, itemId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDraftOriginal(userId: string, itemId: string): Promise<File | null> {
  const db = await openDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(keyFor(userId, itemId));
    request.onsuccess = () => {
      const value = request.result;
      if (value instanceof File) resolve(value);
      else if (value instanceof Blob) resolve(new File([value], "photo", { type: value.type || "image/jpeg" }));
      else resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

export async function deleteDraftOriginal(userId: string, itemId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(keyFor(userId, itemId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
