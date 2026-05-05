export interface InventoryItem {
  id?: string;
  name?: string;
  quantity: number;
  price: number;
  notes: string;
  tags: string[];
  category: string;
  unit?: string;
  taskStatus?: string;
  loggedAt?: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  userId: string;
  updatedAt?: any; // Firestore Timestamp
}

export type UndoAction = 
  | { type: 'ADD'; id: string; item: InventoryItem }
  | { type: 'DELETE'; item: InventoryItem }
  | { type: 'BULK_DELETE'; items: InventoryItem[] }
  | { type: 'UPDATE'; id: string; previousData: Partial<InventoryItem>; newData: Partial<InventoryItem> };
