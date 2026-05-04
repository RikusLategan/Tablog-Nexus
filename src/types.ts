export interface InventoryItem {
  id?: string;
  name?: string;
  quantity: number;
  price: number;
  notes: string;
  tags: string[];
  category: string;
  unit?: string;
  createdAt: any; // Firestore Timestamp
}
