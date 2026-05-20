import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Send, Plus, Minus, Square, RefreshCw, Check, X, Save, Timer } from 'lucide-react';
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
    hasStopwatch: boolean;
    icon?: string;
    parentId?: string;
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
  const [action, setAction] = useState<Action>('USE');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notesAndTags, setNotesAndTags] = useState('');
  const [isAddChildMode, setIsAddChildMode] = useState(false);
  
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [userAlteredTime, setUserAlteredTime] = useState(false);
  const [hasStopwatch, setHasStopwatch] = useState(false);

  const [shiftPressed, setShiftPressed] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);

  const prevEditingId = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
      if (e.key === 'Control' || e.key === 'Meta') setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
      if (e.key === 'Control' || e.key === 'Meta') setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, []);

  const updateTimeIfNotAltered = () => {
    if (!userAlteredTime && !editingItem) {
      const now = new Date();
      setYear(now.getFullYear().toString());
      setMonth((now.getMonth() + 1).toString().padStart(2, '0'));
      setDay(now.getDate().toString().padStart(2, '0'));
      setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
    }
  };

  const clearFields = () => {
    setItem('');
    setQuantity('');
    setUnit('');
    setNotesAndTags('');
    setAction('USE');
    setHasStopwatch(false);
  };

  const populateForEdit = (itemToEdit: InventoryItem) => {
    const loggedOrCreated = itemToEdit.loggedAt || itemToEdit.createdAt;
    const d = loggedOrCreated instanceof Date ? loggedOrCreated : (loggedOrCreated?.toDate?.() || new Date());
    setYear(d.getFullYear().toString());
    setMonth((d.getMonth() + 1).toString().padStart(2, '0'));
    setDay(d.getDate().toString().padStart(2, '0'));
    setTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`);
    setUserAlteredTime(true);
    
    setItem(itemToEdit.category || '');
    setQuantity((itemToEdit.quantity !== undefined && itemToEdit.quantity !== 0 && itemToEdit.quantity !== null) ? Math.abs(itemToEdit.quantity).toString() : '');
    setUnit(itemToEdit.unit || '');
    
    // Reverse action detection
    let currentAction: Action = '';
    let cleanNotes = itemToEdit.notes || '';
    if (itemToEdit.quantity && itemToEdit.quantity > 0) {
      currentAction = 'PURCHASE';
      cleanNotes = cleanNotes.replace(/^\[PURCHASE .*?\]\s?/, '');
    } else if (itemToEdit.quantity && itemToEdit.quantity < 0) {
      currentAction = 'USE';
      cleanNotes = cleanNotes.replace(/^\[USE .*?\]\s?/, '');
    }
    setAction(currentAction);
    
    const tagsToAdd = (itemToEdit.tags || []).filter(t => !cleanNotes.includes(`#${t}`));
    const tagsStr = tagsToAdd.map(t => `#${t}`).join(' ');
    setNotesAndTags(`${cleanNotes}${tagsStr ? ' ' + tagsStr : ''}`.trim());
    setHasStopwatch(itemToEdit.hasStopwatch || false);
  };

  // Handle Editing State
  useEffect(() => {
    if (editingItem && prevEditingId.current !== editingItem.id) {
      const hasInputData = item.trim() !== '' || notesAndTags.trim() !== '' || quantity.trim() !== '';
      
      if (hasInputData) {
        setIsAddChildMode(true);
      } else {
        setIsAddChildMode(false);
        populateForEdit(editingItem);
      }
      prevEditingId.current = editingItem.id;
    } else if (prevEditingId.current && !editingItem) {
      // We were editing but now we're not - user hit cancel or cleared selection
      setIsAddChildMode(false);
      clearFields();
      setUserAlteredTime(false);
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
    if (!editingItem && item.trim() !== '' && quantity === '') {
      setQuantity('1');
    }
  }, [item, editingItem]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!item.trim() && !notesAndTags.trim()) return;

    let finalQty = 0;
    const qtyNum = parseFloat(quantity);
    if (!isNaN(qtyNum)) {
      finalQty = action === 'PURCHASE' ? qtyNum : qtyNum * -1;
    }

    // Parse notes and tags (#tags)
    const tagsArr: string[] = [];
    let notesClean = notesAndTags.replace(/#(\w+)/g, (_, tag) => {
      tagsArr.push(tag);
      return `#${tag}`;
    }).trim();

    let finalTaskStatus = '';
    if (hasStopwatch) {
      finalTaskStatus = 'NOW';
    }

    const finalDate = parseDateOrUseNow(year, month, day, time);
    
    onAdd({
      parentId: (editingItem && isAddChildMode) ? editingItem.id : undefined,
      category: formatItemName(item),
      quantity: finalQty,
      price: 0,
      unit,
      tags: tagsArr,
      notes: notesClean,
      taskStatus: finalTaskStatus,
      loggedAt: finalDate,
      hasStopwatch
    }, (editingItem && !isAddChildMode) ? editingItem.id : undefined);

    // Reset fields
    if (!editingItem || isAddChildMode) {
      setItem('');
      setQuantity('');
      setUnit('');
      setNotesAndTags('');
      setAction('USE');
      setUserAlteredTime(false);
      setHasStopwatch(false);
      setIsAddChildMode(false);
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
    setUserAlteredTime(false);
  };

  const canSubmit = Boolean(item.trim() || notesAndTags.trim());

  return (
    <div className={`p-2 border-t border-border/40 flex flex-col gap-2 font-mono h-auto overflow-x-auto custom-scrollbar transition-colors ${editingItem ? 'bg-primary/5' : 'bg-muted/40'}`}>
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 h-9 min-w-max">
        
        {editingItem && (
          <div className="flex items-center shrink-0 border border-primary/30 h-9">
            <div className={`flex items-center px-2 h-full text-[10px] uppercase font-bold tracking-tighter cursor-pointer transition-colors ${!isAddChildMode ? 'bg-primary/20 text-primary' : 'bg-transparent text-muted-foreground hover:bg-primary/10'}`} onClick={() => { setIsAddChildMode(false); populateForEdit(editingItem); }} title="Edit selected item">
              Edit
            </div>
            <div className={`flex items-center px-2 h-full text-[10px] uppercase font-bold tracking-tighter cursor-pointer transition-colors border-l border-primary/30 ${isAddChildMode ? 'bg-primary/20 text-primary' : 'bg-transparent text-muted-foreground hover:bg-primary/10'}`} onClick={() => { setIsAddChildMode(true); clearFields(); }} title="Add as child to selected">
              Add Child
            </div>
          </div>
        )}
        
        {/* DATE_ENTRY_FIELD */}
        <div className="flex h-9 border border-border/40 bg-background focus-within:border-primary/50 flex-shrink-0">
          <Input 
            type="date"
            value={`${year}-${month}-${day}`}
            onChange={(e) => { 
              const [y, m, d] = e.target.value.split('-');
              if (y && m && d) {
                setYear(y); setMonth(m); setDay(d);
                setUserAlteredTime(true);
              }
            }}
            className="w-[130px] h-full border-0 p-0 pr-1 pl-2 text-center text-[10px] rounded-none focus-visible:ring-0 shadow-none bg-transparent [&::-webkit-calendar-picker-indicator]:dark:invert"
          />
        </div>

        {/* TIME_ENTRY_FIELD */}
        <div className="w-[110px] relative h-9 flex-shrink-0 flex">
          <Input 
            type="time"
            step="60"
            value={time.substring(0, 5)}
            onChange={(e) => { 
              setTime(e.target.value + ":00"); 
              setUserAlteredTime(true); 
            }}
            className="w-full h-full p-0 pr-1 pl-2 text-center text-[10px] bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none shadow-none [&::-webkit-calendar-picker-indicator]:dark:invert"
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

        {/* B. ITEM_ENTRY_FIELD (Always shown) */}
        <div className="flex-[0.8] relative min-w-[120px]">
          <Input 
            list="knownItems"
            placeholder="Item name (e.g. Vitamin D3)"
            value={item}
            onChange={(e) => { setItem(e.target.value); }}
            className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full"
          />
          <datalist id="knownItems">
            {knownItems.map(i => <option key={i} value={i} />)}
          </datalist>
        </div>

        {item.trim() !== '' && (
          <>
            {/* A. Action Dropdown */}
            <div className="relative h-full flex-shrink-0">
              <select 
                value={action}
                onChange={(e) => { setAction(e.target.value as Action); }}
                className="h-9 px-2 bg-background text-foreground border border-border/40 text-[10px] outline-none focus:border-primary/50 rounded-none appearance-none cursor-pointer w-[80px] pr-0"
              >
                <option value="USE">Use</option>
                <option value="PURCHASE">Purchase</option>
              </select>
            </div>

            {/* C. QTY_ENTRY_FIELD */}
            <div className="w-[55px]">
              <Input 
                type="number"
                step={ctrlPressed ? "0.1" : shiftPressed ? "0.5" : "any"}
                min="0"
                placeholder="Qty"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); }}
                className="h-9 text-xs bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full text-center pr-1 pl-[1px]"
              />
            </div>
          </>
        )}

        {/* E. NOTES_ENTRY_FIELD */}
        <div className="flex-[1.5] min-w-[150px]">
          <textarea 
            placeholder="Log journal note & #tags..."
            value={notesAndTags}
            onChange={(e) => { setNotesAndTags(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            rows={1}
            className="min-h-9 py-2 px-3 text-xs bg-background border border-border/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-none w-full block resize-y outline-none custom-scrollbar"
            style={{ fieldSizing: 'content' } as any}
          />
        </div>

        {/* STOPWATCH CHECKBOX */}
        <div className="flex items-center gap-1.5 h-9 px-2 bg-background border border-border/40 flex-shrink-0">
          <input
            type="checkbox"
            id="stopwatch-check"
            checked={hasStopwatch}
            onChange={(e) => setHasStopwatch(e.target.checked)}
            className="w-3 h-3 cursor-pointer accent-primary"
          />
          <label htmlFor="stopwatch-check" className="text-[10px] cursor-pointer select-none">
            <Timer className="w-3.5 h-3.5" />
          </label>
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

