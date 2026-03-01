// ============================================================
// MindVault — IndexedDB Initialisation
// Opens the database, runs schema creation, triggers migration.
// ============================================================

import { DB_NAME, DB_VERSION, createSchema } from './schema';
import { runMigrations } from './migrations/runner';

let dbInstance: IDBDatabase | null = null;

/**
 * Open (or return cached) the MindVault IndexedDB instance.
 * Handles schema creation and migration automatically.
 */
export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance !== null) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      createSchema(db);
      // Run any pending migrations for upgrade path
      void runMigrations(db, oldVersion, DB_VERSION);
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;

      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message ?? 'Unknown error'}`));
    };

    request.onblocked = () => {
      console.warn(
        'MindVault: IndexedDB upgrade blocked — close other extension tabs and retry.'
      );
    };
  });
}

/**
 * Close the database connection (useful for testing).
 */
export function closeDB(): void {
  dbInstance?.close();
  dbInstance = null;
}

/**
 * Execute a read-only transaction on one or more object stores.
 */
export async function readTransaction<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  callback: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx = db.transaction(stores, 'readonly');

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));

    void callback(tx).then(resolve).catch(reject);
  });
}

/**
 * Execute a read-write transaction on one or more object stores.
 */
export async function writeTransaction<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  callback: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx = db.transaction(stores, 'readwrite');

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));

    void callback(tx).then(resolve).catch(reject);
  });
}

/**
 * Wrap an IDBRequest in a Promise.
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
