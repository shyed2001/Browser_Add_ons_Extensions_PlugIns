// Test setup — polyfill IndexedDB for Vitest (happy-dom doesn't include it)
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Reset IndexedDB between each test for full isolation
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// Mock chrome APIs globally
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
  },
  runtime: {
    openOptionsPage: vi.fn(),
    sendNativeMessage: vi.fn(),
    connectNative: vi.fn(),
    lastError: null,
  },
  downloads: {
    search: vi.fn(),
    onCreated: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  },
  history: {
    search: vi.fn(),
    onVisited: { addListener: vi.fn() },
  },
  bookmarks: {
    getTree: vi.fn(),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
