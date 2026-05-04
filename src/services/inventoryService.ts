import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  writeBatch,
  FirestoreError 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { InventoryItem } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ITEMS_COLLECTION = 'items';

export const inventoryService = {
  subscribeToItems: (callback: (items: InventoryItem[]) => void) => {
    const q = query(collection(db, ITEMS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const items: InventoryItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InventoryItem));
      callback(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, ITEMS_COLLECTION);
    });
  },

  addItem: async (item: Omit<InventoryItem, 'id' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, ITEMS_COLLECTION), {
        ...item,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ITEMS_COLLECTION);
    }
  },

  updateItem: async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const docRef = doc(db, ITEMS_COLLECTION, id);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${ITEMS_COLLECTION}/${id}`);
    }
  },

  deleteItem: async (id: string) => {
    try {
      const docRef = doc(db, ITEMS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${ITEMS_COLLECTION}/${id}`);
    }
  },

  bulkDelete: async (ids: string[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      ids.forEach(id => {
        const docRef = doc(db, ITEMS_COLLECTION, id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, ITEMS_COLLECTION);
    }
  },

  bulkUpdate: async (ids: string[], updates: Partial<InventoryItem>) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      ids.forEach(id => {
        const docRef = doc(db, ITEMS_COLLECTION, id);
        batch.update(docRef, updates);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ITEMS_COLLECTION);
    }
  }
};
