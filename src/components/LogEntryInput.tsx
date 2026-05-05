import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Send, Plus, Minus, Square, RefreshCw, Check, X, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { InventoryItem } from '../types';

function parseDateOrUseNow(y: string, m: string, d: string, t: string): Date {
  const now = new Date();
  
  let yearNum = parseInt(y, 10);
  if (isNaN(yearNum)) {
    yearNum = now.getFullYear();
  } else if (yearNum < 100) {
    yearNum += 2000;
  }

  let monthNum = now.getMonth();
  if (!isNaN(parseInt(m, 10))) {
    monthNum = parseInt(m, 10) - 1;
  } else if (m) {
    const mLow = m.toLowerCase().substring(0, 3);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const idx = months.indexOf(mLow);
    if (idx !== -1) monthNum = idx;
  }

  let dayNum = parseInt(d, 10);
  if (isNaN(dayNum)) dayNum = now.getDate();

  let [hh, mm, ss] = t.split(':').map(n => parseInt(n, 10));
  if (isNaN(hh)) hh = now.getHours();
  if (isNaN(mm)) mm = now.getMinutes();
  if (isNaN(ss)) ss = now.getSeconds();

  return new Date(yearNum, monthNum, dayNum, hh, mm, ss, now.getMilliseconds());
}

interface LogEntryInputProps {
  onAdd: (data: { 
    category: string; 
    quantity: number; 
    price: number; 
    unit: string;
    tags: string[]; 
    notes: string; 
    taskStatus: string;
    loggedAt: Date;
  }, id?: string) => void;
  knownItems: string[];
  knownUnits: string[];
  lastUsedUnits: Record<string, string>;
  editingItem?: InventoryItem | null;
  onCancelEdit?: () => void;
}

type Action = 'PURCHASE' | 'USE' | '';

function formatItemName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "(No Item)";
  
  // Rule: If 6 chars or shorter and all uppercase letters (acronyms), leave as is
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (trimmed.length <= 6 && lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase()) {
    return trimmed;
  }

  // Rule: If first character is a letter, capitalise it. Convert all letters except the first to lowercase.
  if (/^[a-zA-Z]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  
  return trimmed;
}

export function LogEntryInput({ onAdd, knownItems, knownUnits, lastUsedUnits, editingItem, onCancelEdit }: LogEntryInputProps) {
  const [action, setAction] = useState<Action>('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notesAndTags, setNotesAndTags] = useState('');
  const [taskStatus, setTaskStatus] = useState<'' | 'TODO' | 'DOING' | 'DONE'>('');
  
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  const prevEditingId = React.useRef<string | undefined>(undefined);

  // Handle Editing State
  useEffect(() => {
    if (editingItem) {
      const d = (editingItem.loggedAt || editingItem.createdAt)?.toDate?.() || new Date();
      setYear(d.getFullYear().toString());
      setMonth((d.getMonth() + 1).toString().padStart(2, '0'));
      setDay(d.getDate().toString().padStart(2, '0'));
      setTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`);
      
      setItem(editingItem.category || '');
      setQuantity(Math.abs(editingItem.quantity || 0).toString());
      setUnit(editingItem.unit || '');
      setTaskStatus(editingItem.taskStatus as any || '');
      
      // Reverse action detection
      let currentAction: Action = '';
      let cleanNotes = editingItem.notes || '';
      if (editingItem.quantity > 0) {
        currentAction = 'PURCHASE';
        cleanNotes = cleanNotes.replace(/^\[PURCHASE .*?\]\s?/, '');
      } else if (editingItem.quantity < 0) {
        currentAction = 'USE';
        cleanNotes = cleanNotes.replace(/^\[USE .*?\]\s?/, '');
      }
      setAction(currentAction);
      
      const tagsStr = editingItem.tags?.map(t => `#${t}`).join(' ') || '';
      setNotesAndTags(`${cleanNotes}${tagsStr ? ' ' + tagsStr : ''}`.trim());
      prevEditingId.current = editingItem.id;
    } else if (prevEditingId.current) {
      // We were editing but now we're not - user hit cancel or cleared selection
      setItem('');
      setQuantity('');
      setUnit('');
      setNotesAndTags('');
      setAction('');
      setTaskStatus('');
      prevEditingId.current = undefined;
      handleRefreshTime();
    }
  }, [editingItem]);

  // Auto-fill logic (Initial)
  useEffect(() => {
    if (!year && !month && !day && !time) {
      const now = new Date();
      setYear(now.getFullYear().toString());
      setMonth((now.getMonth() + 1).toString().padStart(2, '0'));
      setDay(now.getDate().toString().padStart(2, '0'));
      setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
    }
  }, []);

  // Auto-fill unit when item changes
  useEffect(() => {
    if (item && lastUsedUnits[item] && !unit) {
      setUnit(lastUsedUnits[item]);
    }
  }, [item, lastUsedUnits]);

  // Auto-fill quantity when item changes
  useEffect(() => {
    if (item.trim() !== '' && quantity === '') {
      setQuantity('1');
    }
  }, [item]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!item.trim() && !action && !taskStatus && !notesAndTags.trim()) return;

    let finalQty = 0;
    const qtyNum = parseFloat(quantity);
    if (!isNaN(qtyNum)) {
      finalQty = action === 'PURCHASE' ? qtyNum : qtyNum * -1;
    }

    // Parse notes and tags (#tags)
    const tagsArr: string[] = [];
    let notesClean = notesAndTags.replace(/#(\w+)/g, (_, tag) => {
      tagsArr.push(tag);
      return '';
    }).trim();

    if (action && item.trim()) {
      notesClean = `[${action} ${item.trim()}] ${notesClean}`.trim();
    }

    const finalDate = parseDateOrUseNow(year, month, day, time);

    onAdd({
      category: formatItemName(item),
      quantity: finalQty,
      price: 0,
      unit,
      tags: tagsArr,
      notes: notesClean,
      taskStatus,
      loggedAt: finalDate
    }, editingItem?.id);

    // Reset fields
    if (!editingItem) {
      setItem('');
      setQuantity('');
      setUnit('');
      setNotesAndTags('');
      setAction('');
      setTaskStatus('');
    } else {
      // After edit save, we should probably signal a cancel or the parent will clear selection
      if (onCancelEdit) onCancelEdit();
    }
  };

  const handleRefreshTime = () => {
    const now = new Date();
    setYear(now.getFullYear().toString());
    setMonth((now.getMonth() + 1).toString().padStart(2, '0'));
    setDay(now.getDate().toString().padStart(2, '0'));
    setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
  };

  const isDisabled = action === '';
  const canSubmit = (!isDisabled && item && quantity) || (isDisabled && notesAndTags) || (isDisabled && taskStatus);

  return (
    <div className={`p-2 border-t border-border/40 flex flex-col gap-2 font-mono h-auto overflow-x-auto custom-scrollbar transition-colors ${editingItem ? 'bg-primary/5' : 'bg-muted/40'}`}>
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 h-9 min-w-max">
        
        {editingItem && (
          <div className="flex items-center px-2 h-9 bg-primary/20 text-primary text-[10px] uppercase font-bold tracking-tighter shrink-0 border border-primary/30">
            Edit Mode
          </div>
        )}
        
        {/* DATE_ENTRY_FIELD */}
        <div className="flex h-9 border border-border/40 bg-background focus-within:border-primary/50 flex-shrink-0">
          <Input 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="YYYY"
            className="w-[43px] h-full border-0 p-0 px-1 text-center text-[10px] rounded-none focus-visible:ring-0 shadow-none bg-transparent"
          />
          <span className="text-border/40 self-center text-[10px]">-</span>
          <Input 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="MM"
            className="w-8 h-full border-0 p-0 px-1 text-center text-[10px] rounded-none focus-visible:ring-0 shadow-none bg-transparent"
          />
          <span className="text-border/40 self-center text-[10px]">-</span>
          <Input 
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder="DD"
            className="w-7 h-full border-0 p-0 px-1 text-center text-[10px] rounded-none focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>

        {/* TIME_ENTRY_FIELD */}
        <div className="w-[110px] relative h-9 flex-shrink-0 flex">
          <Input 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="HH:mm:ss"
            className="w-full h-full px-1 text-center text-[10px] bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none shadow-none"
          />
          <button 
            type="button"
            onClick={handleRefreshTime}
            className="h-full w-7 flex items-center justify-center hover:text-primary transition-all text-muted-foreground border-y border-r border-border/40 bg-muted/20"
            title="Refresh current time"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* TASK_ENTRY_FIELD */}
        <div className="relative h-full flex-shrink-0">
          <select 
            value={taskStatus}
            onChange={(e) => setTaskStatus(e.target.value as any)}
            className="h-9 px-2 bg-background text-foreground border border-border/40 text-[10px] outline-none focus:border-primary/50 rounded-none appearance-none cursor-pointer w-[73px] pr-0"
          >
            <option value="">[No task]</option>
            <option value="TODO">To Do</option>
            <option value="DOING">Doing</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        {/* A. Action Dropdown */}
        <div className="relative h-full flex-shrink-0">
          <select 
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
            className="h-9 px-2 bg-background text-foreground border border-border/40 text-[10px] outline-none focus:border-primary/50 rounded-none appearance-none cursor-pointer w-[80px] pr-0"
          >
            <option value="">[No action]</option>
            <option value="PURCHASE">Purchase</option>
            <option value="USE">Use</option>
          </select>
        </div>

        {!isDisabled && (
          <>
            {/* B. ITEM_ENTRY_FIELD (Editable Dropbox) */}
            <div className="flex-[0.8] relative min-w-[120px]">
              <Input 
                list="knownItems"
                placeholder="Item name (e.g. Vitamin D3)"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
              />
              <datalist id="knownItems">
                {knownItems.map(i => <option key={i} value={i} />)}
              </datalist>
            </div>

            {/* C. QTY_ENTRY_FIELD */}
            <div className="w-[43px]">
              <Input 
                type="number"
                step="any"
                min="0"
                placeholder="Qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full text-center px-1"
              />
            </div>
          </>
        )}

        {/* E. NOTES_ENTRY_FIELD */}
        <div className="flex-[1.5] min-w-[150px]">
          <Input 
            placeholder="Log journal notes & #tags..."
            value={notesAndTags}
            onChange={(e) => setNotesAndTags(e.target.value)}
            className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {editingItem && (
            <button 
              type="button"
              onClick={onCancelEdit}
              className="h-9 w-10 flex items-center justify-center bg-muted border border-border/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              title="Cancel Edit"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button 
            type="submit"
            disabled={!canSubmit}
            className={`h-9 w-10 flex items-center justify-center transition-all ${editingItem ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' : 'bg-primary text-primary-foreground hover:opacity-90'} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {editingItem ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

