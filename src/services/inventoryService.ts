import { InventoryItem } from '../types';
import { get, set } from 'idb-keyval';

const DB_HANDLE_KEY = 'tablog_db_handle';
const BACKUP_KEY = 'tablog_daily_backup';
const BACKUP_DATE_KEY = 'tablog_backup_date';

type Subscriber = (items: InventoryItem[]) => void;
const subscribers: Set<Subscriber> = new Set();
let activeItems: InventoryItem[] = [];
let dbHandle: FileSystemFileHandle | null = null;

function notifySubscribers() {
  subscribers.forEach(sub => sub(activeItems));
}

function parseItems(data: string): InventoryItem[] {
  try {
    const raw = JSON.parse(data);
    return raw.map((item: any) => ({
      ...item,
      createdAt: { 
        toDate: () => new Date(item.createdAt),
        toMillis: () => new Date(item.createdAt).getTime()
      },
      updatedAt: item.updatedAt ? {
        toDate: () => new Date(item.updatedAt),
        toMillis: () => new Date(item.updatedAt).getTime()
      } : undefined,
      loggedAt: item.loggedAt ? {
        toDate: () => new Date(item.loggedAt),
        toMillis: () => new Date(item.loggedAt).getTime()
      } : undefined
    }));
  } catch (e) {
    console.error('Failed to parse items', e);
    return [];
  }
}

function serializeItems(items: InventoryItem[]): string {
  const serialized = items.map(item => {
    const defaultDateStr = new Date().toISOString();
    return {
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : (item.createdAt as any)?.toDate?.()?.toISOString() || defaultDateStr,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : (item.updatedAt as any)?.toDate?.()?.toISOString() || defaultDateStr,
      loggedAt: item.loggedAt instanceof Date ? item.loggedAt.toISOString() : (item.loggedAt as any)?.toDate?.()?.toISOString() || undefined
    };
  });
  return JSON.stringify(serialized, null, 2);
}

async function performDailyBackup() {
  const today = new Date().toISOString().split('T')[0];
  const lastBackup = await get(BACKUP_DATE_KEY);
  if (lastBackup !== today) {
    const serialized = serializeItems(activeItems);
    await set(BACKUP_KEY, serialized);
    await set(BACKUP_DATE_KEY, today);
    console.log('Daily backup completed.');
  }
}

async function saveItems(items: InventoryItem[]) {
  activeItems = items;
  notifySubscribers();
  
  // Auto-save to disk
  if (dbHandle) {
    try {
      const writable = await dbHandle.createWritable();
      const content = serializeItems(activeItems);
      await writable.write(content);
      await writable.close();
      await performDailyBackup();
    } catch (e) {
      console.error('Error auto-saving to disk:', e);
    }
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const inventoryService = {
  getDbName: () => dbHandle?.name,
  
  hasSavedHandle: async (): Promise<boolean> => {
    const handle = await get<FileSystemFileHandle>(DB_HANDLE_KEY);
    return !!handle;
  },

  checkPermission: async (handle: FileSystemFileHandle) => {
    const opts = { mode: 'readwrite' as const };
    if ((await (handle as any).queryPermission(opts)) === 'granted') {
      return true;
    }
    if ((await (handle as any).requestPermission(opts)) === 'granted') {
      return true;
    }
    return false;
  },

  loadSavedHandle: async () => {
    const handle = await get<FileSystemFileHandle>(DB_HANDLE_KEY);
    if (handle) {
      const hasPerm = await inventoryService.checkPermission(handle);
      if (hasPerm) {
        dbHandle = handle;
        await inventoryService.readFromFile();
        return true;
      }
    }
    return false;
  },

  openDatabase: async () => {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: 'Database JSON', accept: { 'application/json': ['.json'] } }]
    });
    dbHandle = handle;
    await set(DB_HANDLE_KEY, handle);
    await inventoryService.readFromFile();
  },

  createDatabase: async () => {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'tablog_db.json',
      types: [{ description: 'Database JSON', accept: { 'application/json': ['.json'] } }]
    });
    dbHandle = handle;
    activeItems = [];
    await set(DB_HANDLE_KEY, handle);
    await saveItems(activeItems);
  },

  readFromFile: async () => {
    if (!dbHandle) return;
    const file = await dbHandle.getFile();
    const text = await file.text();
    activeItems = text ? parseItems(text) : [];
    notifySubscribers();
  },

  restoreDailyBackup: async () => {
    const backupData = await get<string>(BACKUP_KEY);
    if (!backupData) return false;
    
    // We need to restore it to the currently open DB or demand creating a new DB.
    // If we just load it into activeItems, it will be saved next time we modify.
    // To make it explicit, we force them to "Create New Database" for the backup.
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'tablog_backup_recovered.json',
      types: [{ description: 'Database JSON', accept: { 'application/json': ['.json'] } }]
    });
    dbHandle = handle;
    await set(DB_HANDLE_KEY, handle);
    
    activeItems = parseItems(backupData);
    await saveItems(activeItems); // this saves to the newly chosen file
    return true;
  },

  disconnect: async () => {
    dbHandle = null;
    activeItems = [];
    notifySubscribers();
  },

  subscribeToItems: (callback: (items: InventoryItem[]) => void) => {
    subscribers.add(callback);
    callback(activeItems);
    return () => {
      subscribers.delete(callback);
    };
  },

  addItem: async (item: Omit<InventoryItem, 'id' | 'createdAt' | 'userId'> & { loggedAt?: Date | any }) => {
    const newId = generateId();
    
    const now = new Date();
    const newItem: any = {
      ...item,
      id: newId,
      userId: 'local-user',
      createdAt: { toDate: () => now, toMillis: () => now.getTime() },
      updatedAt: { toDate: () => now, toMillis: () => now.getTime() }
    };

    if (item.loggedAt instanceof Date) {
      newItem.loggedAt = { toDate: () => item.loggedAt, toMillis: () => item.loggedAt.getTime() };
    } else if (item.loggedAt?.toDate) {
      newItem.loggedAt = item.loggedAt;
    }

    await saveItems([...activeItems, newItem]);
    return newId;
  },

  restoreItem: async (item: InventoryItem) => {
    const items = [...activeItems];
    if (item.id) {
      const existingIdx = items.findIndex(i => i.id === item.id);
      if (existingIdx !== -1) {
        items[existingIdx] = { ...item, userId: 'local-user' };
      } else {
        items.push({ ...item, userId: 'local-user' });
      }
    } else {
      items.push({ ...item, id: generateId(), userId: 'local-user' });
    }
    await saveItems(items);
  },

  updateItem: async (id: string, updates: Partial<InventoryItem>) => {
    const items = [...activeItems];
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const now = new Date();
      const mappedUpdates: any = { ...updates };
      if (mappedUpdates.loggedAt instanceof Date) {
        mappedUpdates.loggedAt = { toDate: () => updates.loggedAt, toMillis: () => (updates.loggedAt as Date).getTime() };
      }
      items[idx] = { 
        ...items[idx], 
        ...mappedUpdates, 
        updatedAt: { toDate: () => now, toMillis: () => now.getTime() } as any 
      };
      await saveItems(items);
    }
  },

  deleteItem: async (id: string) => {
    const items = activeItems.filter(i => i.id !== id);
    await saveItems(items);
  },

  bulkDelete: async (ids: string[]) => {
    const items = activeItems.filter(i => !ids.includes(i.id!));
    await saveItems(items);
  },

  bulkUpdate: async (ids: string[], updates: Partial<InventoryItem>) => {
    const items = [...activeItems];
    const now = new Date();
    
    const mappedUpdates: any = { ...updates };
    if (mappedUpdates.loggedAt instanceof Date) {
      mappedUpdates.loggedAt = { toDate: () => updates.loggedAt, toMillis: () => (updates.loggedAt as Date).getTime() };
    }

    ids.forEach(id => {
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) {
        items[idx] = { 
          ...items[idx], 
          ...mappedUpdates, 
          updatedAt: { toDate: () => now, toMillis: () => now.getTime() } as any 
        };
      }
    });
    await saveItems(items);
  },

  importItems: async (newItems: any[], merge: boolean = true) => {
    let items = merge ? [...activeItems] : [];
    
    for (const item of newItems) {
      const now = new Date();
      const createdAt = new Date(item.createdAt || Date.now());
      const updatedAt = new Date(item.updatedAt || Date.now());
      const loggedAt = item.loggedAt ? new Date(item.loggedAt) : undefined;
      
      const parsedItem: any = {
        ...item,
        id: item.id || generateId(),
        userId: 'local-user',
        createdAt: { toDate: () => createdAt, toMillis: () => createdAt.getTime() },
        updatedAt: { toDate: () => updatedAt, toMillis: () => updatedAt.getTime() },
      };
      
      if (loggedAt) {
        parsedItem.loggedAt = { toDate: () => loggedAt, toMillis: () => loggedAt.getTime() };
      }
      
      const existingIdx = items.findIndex(i => i.id === parsedItem.id);
      if (existingIdx !== -1) {
        items[existingIdx] = Object.assign({}, items[existingIdx], parsedItem);
      } else {
        items.push(parsedItem);
      }
    }
    await saveItems(items);
  }
};

