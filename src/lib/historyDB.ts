// IndexedDB utilities for storing simulation history

const DB_NAME = "CacheSimulatorHistory";
const STORE_NAME = "simulations";
const DB_VERSION = 1;

export interface SimulationHistoryEntry {
  id?: number;
  timestamp: number;
  config: {
    l1?: {
      cacheSize: number;
      blockSize: number;
      associativity: number;
      replacementPolicy: string;
      writePolicy: string;
    };
    l2?: {
      cacheSize: number;
      blockSize: number;
      associativity: number;
      replacementPolicy: string;
      writePolicy: string;
    };
    enabled: {
      l1: boolean;
      l2: boolean;
    };
  };
  trace: {
    length: number;
    pattern?: string;
  };
  stats: {
    l1?: {
      hits: number;
      misses: number;
      hitRate: number;
      totalAccesses: number;
      writebacks: number;
    };
    l2?: {
      hits: number;
      misses: number;
      hitRate: number;
      totalAccesses: number;
      writebacks: number;
    };
    combined: {
      hits: number;
      misses: number;
      hitRate: number;
      totalAccesses: number;
      writebacks: number;
    };
  };
  memoryStats?: {
    totalReads: number;
    totalWrites: number;
    totalAccesses: number;
    bytesTransferred: number;
    averageLatency: number;
  };
}

// Initialize or get database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    console.log("[IndexedDB] Opening database...");
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[IndexedDB] Error opening database:", request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log("[IndexedDB] Database opened successfully");
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });

        // Create index on timestamp for sorting
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

// Save a simulation run to history
export async function saveSimulationToHistory(
  entry: Omit<SimulationHistoryEntry, "id">,
): Promise<number> {
  console.log("[IndexedDB] Saving simulation to history...", entry);
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(entry);

    request.onsuccess = () => {
      console.log("[IndexedDB] Saved with ID:", request.result);
      resolve(request.result as number);
    };
    request.onerror = () => {
      console.error("[IndexedDB] Error saving:", request.error);
      reject(request.error);
    };
  });
}

// Get all simulation history entries (sorted by most recent first)
export async function getAllHistory(): Promise<SimulationHistoryEntry[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev"); // Descending order (newest first)

    const results: SimulationHistoryEntry[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// Delete a specific history entry
export async function deleteHistoryEntry(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear all history
export async function clearAllHistory(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get history entry count
export async function getHistoryCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get a specific history entry by ID
export async function getHistoryEntry(
  id: number,
): Promise<SimulationHistoryEntry | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
