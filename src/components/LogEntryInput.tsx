import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Send, Plus, Minus, Square } from 'lucide-react';
import { motion } from 'motion/react';

interface LogEntryInputProps {
  onAdd: (data: { 
    category: string; 
    quantity: number; 
    price: number; 
    unit: string;
    tags: string[]; 
    notes: string; 
  }) => void;
  knownItems: string[];
  knownUnits: string[];
  lastUsedUnits: Record<string, string>;
}

type Action = 'PURCHASED' | 'USED' | '';

export function LogEntryInput({ onAdd, knownItems, knownUnits, lastUsedUnits }: LogEntryInputProps) {
  const [action, setAction] = useState<Action>('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notesAndTags, setNotesAndTags] = useState('');

  // Auto-fill unit when item changes
  useEffect(() => {
    if (item && lastUsedUnits[item] && !unit) {
      setUnit(lastUsedUnits[item]);
    }
  }, [item, lastUsedUnits]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!action) return;
    if (!item.trim() || !quantity.trim()) return;

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert("Please enter a positive numeric quantity.");
      return;
    }

    // if ACTION == PURCHASED, QTY = QTY * -1
    const finalQty = action === 'PURCHASED' ? qtyNum * -1 : qtyNum;

    // Parse notes and tags (#tags)
    const tagsArr: string[] = [];
    let notesClean = notesAndTags.replace(/#(\w+)/g, (_, tag) => {
      tagsArr.push(tag);
      return '';
    }).trim();

    notesClean = `[${action} ${item.trim()}] ${notesClean}`.trim();

    onAdd({
      category: item,
      quantity: finalQty,
      price: 0, // Defaulting price as it wasn't explicitly in the input logic but useful to keep
      unit,
      tags: tagsArr,
      notes: notesClean
    });

    // Reset fields keeping context if useful, but usually clear for next log
    setItem('');
    setQuantity('');
    setUnit('');
    setNotesAndTags('');
    setAction('');
  };

  const isDisabled = action === '';

  return (
    <div className="p-2 bg-muted/40 border-t border-border/40 flex flex-col gap-2 font-mono h-[80px]">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 h-9">
        {/* A. Action Dropdown */}
        <div className="relative h-full flex-shrink-0">
          <select 
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
            className="h-9 px-3 bg-background text-foreground border border-border/40 text-[10px] uppercase tracking-widest outline-none focus:border-primary/50 rounded-none appearance-none cursor-pointer pr-8"
          >
            <option value="">[EMPTY]</option>
            <option value="PURCHASED">PURCHASED</option>
            <option value="USED">USED</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 scale-75">
            {action === 'PURCHASED' ? <Minus className="w-3 h-3 text-red-500" /> : action === 'USED' ? <Plus className="w-3 h-3 text-emerald-500" /> : <Square className="w-3 h-3" />}
          </div>
        </div>

        {!isDisabled && (
          <>
            {/* B. ITEM_ENTRY_FIELD (Editable Dropbox) */}
            <div className="flex-1 relative">
              <Input 
                list="knownItems"
                placeholder="ITEM NAME (e.g. Vitamin D3)"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
              />
              <datalist id="knownItems">
                {knownItems.map(i => <option key={i} value={i} />)}
              </datalist>
            </div>

            {/* C. QTY_ENTRY_FIELD */}
            <div className="w-20">
              <Input 
                type="number"
                step="any"
                min="0"
                placeholder="QTY"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
              />
            </div>

            {/* D. UNIT_ENTRY_FIELD (Editable Dropbox) */}
            <div className="w-24">
              <Input 
                list="knownUnits"
                placeholder="UNIT"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-9 text-[10px] uppercase bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
              />
              <datalist id="knownUnits">
                {knownUnits.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>

            {/* E. NOTES_ENTRY_FIELD */}
            <div className="flex-[1.5]">
              <Input 
                placeholder="LOG JOURNAL NOTES & #TAGS..."
                value={notesAndTags}
                onChange={(e) => setNotesAndTags(e.target.value)}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
              />
            </div>

            <button 
              type="submit"
              disabled={!item || !quantity}
              className="h-9 w-10 flex-shrink-0 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        )}
      </form>
      
      <div className="text-[9px] uppercase tracking-tighter opacity-40 ml-1 h-3">
        {isDisabled && "Select [PURCHASED] or [USED] to begin entry."}
      </div>
    </div>
  );
}
