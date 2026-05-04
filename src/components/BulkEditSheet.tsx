import React, { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter,
  SheetClose
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InventoryItem } from '../types';

interface BulkEditSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSave: (updates: Partial<InventoryItem>) => void;
}

export function BulkEditSheet({ isOpen, onOpenChange, selectedCount, onSave }: BulkEditSheetProps) {
  const [category, setCategory] = useState('');
  const [addTags, setAddTags] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleApply = () => {
    const updates: Partial<InventoryItem> = {};
    if (category) updates.category = category;
    if (price) updates.price = parseFloat(price);
    if (quantity) updates.quantity = parseInt(quantity);
    
    if (addTags) {
       updates.tags = addTags.split(',').map(t => t.trim()).filter(Boolean);
    }

    onSave(updates);
    onOpenChange(false);
    // Reset fields
    setCategory('');
    setAddTags('');
    setPrice('');
    setQuantity('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zinc-950 border-l border-primary/20 text-foreground font-mono">
        <SheetHeader className="border-b border-border/40 pb-4">
          <SheetTitle className="text-primary uppercase tracking-[0.2em] text-sm">Bulk Item Modification</SheetTitle>
          <SheetDescription className="text-[10px] uppercase opacity-50">
            Targeting {selectedCount} units in active memory.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider opacity-60">Set Inventory Item Name</label>
            <Input 
              placeholder="e.g. Paracetamol, Insulin..." 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-zinc-900 border-border/40 rounded-none h-8 text-xs focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider opacity-60">Set Price (Optional)</label>
            <Input 
              type="number"
              placeholder="0.00" 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-zinc-900 border-border/40 rounded-none h-8 text-xs focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider opacity-60">Set Quantity (Optional)</label>
            <Input 
              type="number"
              placeholder="0" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-zinc-900 border-border/40 rounded-none h-8 text-xs focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider opacity-60">Set Tags (Comma separated)</label>
            <Input 
              placeholder="Tag1, Tag2, Tag3..." 
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              className="bg-zinc-900 border-border/40 rounded-none h-8 text-xs focus-visible:ring-primary/30"
            />
            <p className="text-[9px] opacity-40 italic">Note: This will overwrite existing tags on selected items.</p>
          </div>
        </div>

        <SheetFooter className="border-t border-border/40 pt-4 mt-auto">
          <div className="flex flex-col w-full gap-2">
            <Button 
              className="w-full rounded-none uppercase tracking-widest text-xs h-9 bg-primary text-primary-foreground hover:opacity-90"
              onClick={handleApply}
              disabled={!category && !price && !quantity && !addTags}
            >
              Apply Changes
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-none uppercase tracking-widest text-xs h-9 border-border/40">
                Cancel
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
