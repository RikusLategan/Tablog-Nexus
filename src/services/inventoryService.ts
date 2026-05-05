import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  orderBy, 
  where,
  serverTimestamp,
  writeBatch,
  FirestoreError,
  setDoc
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
    const user = auth.currentUser;
    if (!user) return () => {};

    const q = query(
      collection(db, ITEMS_COLLECTION), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
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

  addItem: async (item: Omit<InventoryItem, 'id' | 'createdAt' | 'userId'> & { loggedAt?: Date | any }) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const { Timestamp } = await import('firebase/firestore');
      const payload: any = {
        ...item,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (item.loggedAt instanceof Date) {
        payload.loggedAt = Timestamp.fromDate(item.loggedAt);
      }
      const docRef = await addDoc(collection(db, ITEMS_COLLECTION), payload);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ITEMS_COLLECTION);
    }
  },

  restoreItem: async (item: InventoryItem) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const { id, ...data } = item;
      const payload = { ...data, userId: user.uid };

      if (id) {
        await setDoc(doc(db, ITEMS_COLLECTION, id), payload);
      } else {
        await addDoc(collection(db, ITEMS_COLLECTION), payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ITEMS_COLLECTION);
    }
  },

  updateItem: async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const docRef = doc(db, ITEMS_COLLECTION, id);
      await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${ITEMS_COLLECTION}/${id}`);
    }
  },

  deleteItem: async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const docRef = doc(db, ITEMS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${ITEMS_COLLECTION}/${id}`);
    }
  },

  bulkDelete: async (ids: string[]) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

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
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const batch = writeBatch(db);
      ids.forEach(id => {
        const docRef = doc(db, ITEMS_COLLECTION, id);
        batch.update(docRef, { ...updates, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ITEMS_COLLECTION);
    }
  }
};
