import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { InventoryItem } from '@/src/types';
import { calculateDepths } from '../lib/exportUtils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Trash2, ArrowUpDown, ChevronUp, ChevronDown, Pencil, Pause, Play, Timer } from 'lucide-react';

interface InventoryTableProps {
  items: InventoryItem[];
  allItems: InventoryItem[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  sortConfig: { key: keyof InventoryItem | null, direction: 'asc' | 'desc' };
  onSort: (key: keyof InventoryItem) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onToggleStopwatch: (item: InventoryItem, isPaused: boolean, elapsedMs: number, resumedAt: number) => void;
}

function getOrdinal(n: number) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
}

function StopwatchTimer({ item, isSelected, onToggle }: { item: InventoryItem, isSelected: boolean, onToggle: (item: InventoryItem, isPaused: boolean, currentElapsedMs: number, resumedAt: number) => void }) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (isSelected && item.hasStopwatch && !item.isStopwatchPaused) {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [isSelected, item.hasStopwatch, item.isStopwatchPaused]);

  if (!item.hasStopwatch) return <span className="text-background select-none">--:--:--</span>;
  
  let diffMs = 0;
  if (item.isStopwatchPaused) {
    diffMs = item.stopwatchElapsedMs || 0;
  } else {
    const dateObj = item.loggedAt || item.createdAt;
    if (!dateObj) return <span>...</span>;
    const startMs = dateObj instanceof Date ? dateObj.getTime() : (dateObj.toMillis ? dateObj.toMillis() : dateObj.toDate?.().getTime());
    if (!startMs) return <span>...</span>;
    const resumeMs = item.stopwatchLastResumedAt || startMs;
    diffMs = Date.now() - resumeMs + (item.stopwatchElapsedMs || 0);
  }
  
  if (diffMs < 0) diffMs = 0;
  
  const s = Math.floor(diffMs / 1000) % 60;
  const m = Math.floor(diffMs / (1000 * 60)) % 60;
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  
  return (
    <div className="flex items-center gap-1.5" onMouseEnter={() => setTick(t => t + 1)}>
      <span>{`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}</span>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (!item.id) return;
          let exactDiffMs = 0;
          if (item.isStopwatchPaused) {
            exactDiffMs = item.stopwatchElapsedMs || 0;
          } else {
            const dateObj = item.loggedAt || item.createdAt;
            const startMs = dateObj instanceof Date ? dateObj.getTime() : (dateObj?.toMillis ? dateObj.toMillis() : (dateObj?.toDate ? dateObj.toDate().getTime() : Date.now()));
            const resumeMs = item.stopwatchLastResumedAt || startMs;
            exactDiffMs = Date.now() - resumeMs + (item.stopwatchElapsedMs || 0);
          }
          if (exactDiffMs < 0) exactDiffMs = 0;
          onToggle(item, !item.isStopwatchPaused, exactDiffMs, Date.now());
        }}
        className="opacity-50 hover:opacity-100 hover:text-foreground transition-all ml-1 bg-background/50 rounded-none border border-primary/20 p-0.5"
        title={item.isStopwatchPaused ? "Resume Stopwatch" : "Pause Stopwatch"}
      >
        {item.isStopwatchPaused ? <Play className="w-[10px] h-[10px]" /> : <Pause className="w-[10px] h-[10px]" />}
      </button>
    </div>
  );
}

export function InventoryTable({ 
  items, 
  allItems,
  onDelete, 
  onEdit,
  sortConfig, 
  onSort, 
  selectedIds, 
  onSelectionChange,
  onToggleStopwatch,
  inventory,
  maxInventory
}: InventoryTableProps & { inventory: Record<string, number>, maxInventory: Record<string, number> }) {
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);

  const depthMap = React.useMemo(() => {
    const depths = calculateDepths(items, allItems);
    const map = new Map<string, number>();
    depths.forEach(({item, depth}) => {
      if (item.id) map.set(item.id, depth);
    });
    return map;
  }, [items, allItems]);

  const { showYear, showMonth, showDay } = React.useMemo(() => {
    if (items.length <= 1) return { showYear: true, showMonth: true, showDay: true };

    const firstDate = (items[0].loggedAt || items[0].createdAt)?.toDate?.();
    if (!firstDate) return { showYear: true, showMonth: true, showDay: true };

    const firstY = format(firstDate, 'yyyy');
    const firstM = format(firstDate, 'MMM');
    const firstD = format(firstDate, 'dd');

    let allY = true;
    let allM = true;
    let allD = true;

    for (const item of items) {
      const d = (item.loggedAt || item.createdAt)?.toDate?.();
      if (!d) continue;
      if (format(d, 'yyyy') !== firstY) allY = false;
      if (format(d, 'MMM') !== firstM) allM = false;
      if (format(d, 'dd') !== firstD) allD = false;
    }

    return { 
      showYear: !allY, 
      showMonth: !allY || !allM, 
      showDay: !allY || !allM || !allD 
    };
  }, [items]);

  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({
    notes: 500,
    category: 180,
    quantity: 80,
    stopwatch: 145,
    tags: 15,
    createdAt: 60,
    icon: 35,
    year: 80,
    month: 71,
    day: 95
  });

  // Dynamic column width adjustment to avoid horizontal scrollbars
  React.useEffect(() => {
    let extraWidth = 0;
    if (showYear) extraWidth += 80;
    if (showMonth) extraWidth += 71;
    if (showDay) extraWidth += 95;

    setColumnWidths(prev => {
      const baseNotesWidth = 500;
      
      // Try to shrink notes first
      let remainingToShrink = extraWidth;
      
      let newNotesWidth = baseNotesWidth;

      if (remainingToShrink > 0) {
        const notesShrink = Math.min(remainingToShrink, baseNotesWidth - 200);
        newNotesWidth -= notesShrink;
      }

      if (prev.notes !== newNotesWidth) {
        return { ...prev, notes: newNotesWidth };
      }
      return prev;
    });
  }, [showYear, showMonth, showDay]);

  const resizingRef = React.useRef<{ key: string, startX: number, startWidth: number } | null>(null);

  const onMouseDown = (key: string, e: React.MouseEvent) => {
    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth: columnWidths[key] || 100
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const onMouseMove = (e: MouseEvent) => {
    const current = resizingRef.current;
    if (!current) return;
    
    const deltaX = e.clientX - current.startX;
    const newWidth = Math.max(50, current.startWidth + deltaX);
    const key = current.key;
    
    setColumnWidths(prev => ({
      ...prev,
      [key]: newWidth
    }));
  };

  const onMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map(i => i.id!).filter(Boolean)));
    }
  };

  const toggleSelectItem = (id: string, index?: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  };

  const handleRowClick = (e: React.MouseEvent, id: string, index: number) => {
    e.preventDefault();
    if (e.shiftKey && lastSelectedIndex !== null) {
      const next = new Set(selectedIds);
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        const item = items[i];
        if (item && item.id) {
          next.add(item.id);
        }
      }
      onSelectionChange(next);
      setLastSelectedIndex(index);
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelectItem(id, index);
    } else {
      if (selectedIds.has(id) && selectedIds.size === 1) {
        onSelectionChange(new Set());
        setLastSelectedIndex(null);
      } else {
        onSelectionChange(new Set([id]));
        setLastSelectedIndex(index);
      }
    }
  };

  const SortIcon = ({ column }: { column: keyof InventoryItem }) => {
    if (!sortConfig || sortConfig.key !== column) return <ArrowUpDown className="ml-1 w-2.5 h-2.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 w-2.5 h-2.5 text-primary" /> : <ChevronDown className="ml-1 w-2.5 h-2.5 text-primary" />;
  };

  return (
    <div className="rounded-none">
      <Table className="table-fixed border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-50">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-10 h-8 p-0 text-center sticky top-0 bg-background z-[60] border-b border-border/40">
              <div className="flex items-center justify-center h-full">
                <Checkbox 
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onCheckedChange={toggleSelectAll}
                  className="rounded-none border-border/40"
                />
              </div>
            </TableHead>
            {/* Columns */}
            {([
              ...(showYear ? [{ label: 'Year', key: 'year', sortable: true, align: 'left' }] : []),
              ...(showMonth ? [{ label: 'Month', key: 'month', sortable: true, align: 'left' }] : []),
              ...(showDay ? [{ label: 'Day', key: 'day', sortable: true, align: 'left' }] : []),
              { label: 'Time', key: 'createdAt', sortable: true, align: 'left' },
              { label: 'Icon', key: 'icon', sortable: true, align: 'center' },
              { label: 'Item', key: 'category', sortable: true, align: 'left' },
              { label: 'Qty', key: 'quantity', sortable: true, align: 'left' },
              { label: <Timer className="w-4 h-4" />, key: 'stopwatch', sortable: false, align: 'left' },
              { label: 'Note', key: 'notes', sortable: true, align: 'left', className: 'border-l border-r border-white/20' },
              { label: 'Tags', key: 'tags', sortable: false, align: 'left' }
            ] as { label: React.ReactNode, key: string, sortable: boolean, align: 'left' | 'right', className?: string }[]).map((col) => (
              <TableHead 
                key={col.key}
                className={`p-0 h-8 relative sticky top-0 bg-background z-[60] border-b border-border/40 ${col.className || ''} ${col.align === 'right' ? "text-right" : ""}`}
                style={{ width: columnWidths[col.key] || 100 }}
              >
                <div className="flex items-center h-full relative group/header">
                  <div 
                    className={`flex-1 flex items-center px-2 font-mono text-sm font-bold uppercase tracking-wider h-full ${col.sortable ? 'cursor-pointer hover:bg-muted/80' : ''} ${col.align === 'right' ? 'justify-end' : ''}`}
                    onClick={() => col.sortable && onSort((col.key === 'year' || col.key === 'month' || col.key === 'day') ? 'createdAt' : col.key as keyof InventoryItem)}
                  >
                    {col.label} {col.sortable && <SortIcon column={(col.key === 'year' || col.key === 'month' || col.key === 'day') ? 'createdAt' : col.key as keyof InventoryItem} />}
                  </div>
                  {/* Resize Handle */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-20"
                    onMouseDown={(e) => onMouseDown(col.key, e)}
                  />
                </div>
              </TableHead>
            ))}
            <TableHead className="w-full p-0 sticky top-0 bg-background z-[55] border-b border-border/40"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={item.id}
              className={`group border-b transition-colors border-border/20 cursor-pointer select-none ${
                selectedIds.has(item.id!) 
                  ? 'bg-primary/10 border-l-2 border-l-primary' 
                  : 'hover:bg-primary/5'
              }`}
              onClick={(e) => handleRowClick(e, item.id!, index)}
            >
              <TableCell className="p-0">
                <div 
                  className="flex items-center justify-center h-full min-h-[40px]"
                  onClickCapture={(e) => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRowClick(e, item.id!, index);
                    }
                  }}
                >
                  <Checkbox 
                    checked={selectedIds.has(item.id!)}
                    onCheckedChange={() => toggleSelectItem(item.id!, index)}
                    onClick={(e) => { e.stopPropagation(); }}
                    className="rounded-none border-border/40"
                  />
                </div>
              </TableCell>

              {/* Dynamic Date Columns */}
              {showYear && (
                <TableCell className="py-2 text-sm font-mono whitespace-nowrap" style={{ width: columnWidths.year }}>
                  {(() => {
                    const d = (item.loggedAt || item.createdAt)?.toDate?.();
                    return d ? format(d, 'yyyy') : '...';
                  })()}
                </TableCell>
              )}
              {showMonth && (
                <TableCell className="py-2 text-sm font-mono whitespace-nowrap" style={{ width: columnWidths.month }}>
                  {(() => {
                    const d = (item.loggedAt || item.createdAt)?.toDate?.();
                    return d ? format(d, 'MMM') : '...';
                  })()}
                </TableCell>
              )}
              {showDay && (
                <TableCell className="py-2 text-sm font-mono whitespace-nowrap" style={{ width: columnWidths.day }}>
                  {(() => {
                    const d = (item.loggedAt || item.createdAt)?.toDate?.();
                    if (!d) return '...';
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const isWithinLastWeek = diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
                    if (isWithinLastWeek) {
                      const dayName = format(d, 'eee');
                      const ordinalDay = getOrdinal(d.getDate());
                      return `${dayName} (${ordinalDay})`;
                    }
                    return getOrdinal(d.getDate());
                  })()}
                </TableCell>
              )}

              <TableCell className="py-2 text-sm font-mono text-foreground" style={{ width: columnWidths.createdAt }}>
                {(() => {
                  const dateObj = item.loggedAt || item.createdAt;
                  if (!dateObj?.toDate) return 'Pending...';
                  const formattedTime = format(dateObj.toDate(), 'HH:mm:ss');
                  return (
                    <>
                      {formattedTime.slice(0, 5)}
                      <span className="text-background select-none">{formattedTime.slice(5)}</span>
                    </>
                  );
                })()}
              </TableCell>
              <TableCell className="py-2 text-center text-sm" style={{ width: columnWidths.icon }}>
                {item.icon ? (
                  item.icon.startsWith('http') || item.icon.startsWith('data:image') ? (
                    <img src={item.icon} alt="Icon" className="w-5 h-5 object-contain inline-block" />
                  ) : (
                    <span title={item.icon}>{item.icon}</span>
                  )
                ) : (
                  <span className="text-muted-foreground/30">—</span>
                )}
              </TableCell>
              <TableCell className="font-medium py-2 text-sm truncate" style={{ width: columnWidths.category }}>
                <span className={item.category === "(No Item)" ? "text-background select-none" : ""}>
                  {item.category}{' '}
                </span>
                <span 
                  className={`text-xs ml-1 ${
                    item.category === "(No Item)" ? "text-background select-none" :
                    (inventory[item.category] || 0) < ((maxInventory[item.category] || 0) / 3) 
                      ? 'text-red-500 font-bold' 
                      : 'opacity-50'
                  }`}
                >
                  ({inventory[item.category] || 0})
                </span>
              </TableCell>
              <TableCell className="py-2 text-sm font-mono" style={{ width: columnWidths.quantity }}>
                <span className={(item.quantity === 0 || item.quantity === 1 || item.category === "(No Item)") ? "text-background select-none" : ""}>
                  {Math.abs(item.quantity)}
                </span>
              </TableCell>
              <TableCell className={`py-2 text-sm font-mono ${item.isStopwatchPaused ? 'text-white' : 'text-primary'}`} style={{ width: columnWidths.stopwatch }}>
                <StopwatchTimer 
                  item={item} 
                  isSelected={item.id ? selectedIds.has(item.id) : false} 
                  onToggle={onToggleStopwatch} 
                />
              </TableCell>
              <TableCell className={`py-2 text-sm text-foreground overflow-hidden align-top border-l border-r border-white`} style={{ width: columnWidths.notes }}>
                {(() => {
                  const notes = item.notes || '';
                  const match = notes.match(/^(\t+)/);
                  const legacyIndent = match ? match[1].length : 0;
                  const hierarchyIndent = (item.id && depthMap.get(item.id)) || 0;
                  const indentLevel = Math.max(legacyIndent, hierarchyIndent);
                  const displayNotes = match ? notes.substring(match[1].length) : notes;
                  return (
                    <div className="max-w-none text-sm break-words" style={{ paddingLeft: `${indentLevel * 1.5}rem` }}>
                      <Markdown remarkPlugins={[remarkGfm]} components={{
                         p: ({node, ...props}) => <p className="mb-1 last:mb-0 inline-block mr-1" {...props} />,
                         a: ({node, ...props}) => <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />,
                         h1: ({node, ...props}) => <h1 className="text-base font-bold mt-2 mb-1 pb-1 border-b border-white" {...props} />,
                         h2: ({node, ...props}) => <h2 className="text-sm font-bold mt-1.5 mb-0.5 pb-1 border-b border-white" {...props} />,
                         h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-1 mb-0.5" {...props} />,
                         hr: ({node, ...props}) => <hr className="my-2 border-border/40" {...props} />,
                         ul: ({node, ...props}) => <ul className="list-disc list-inside mb-1" {...props} />,
                         ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-1" {...props} />,
                         li: ({node, ...props}) => <li className="ml-1" {...props} />,
                         blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-border/50 pl-2 text-muted-foreground my-1 italic" {...props} />,
                         code: ({node, inline, className, children, ...props}: any) => {
                           return !inline ? (
                             <pre className="bg-muted/50 p-2 rounded-md my-1 overflow-x-auto text-[11px] font-mono block">
                               <code className={className} {...props}>{children}</code>
                             </pre>
                           ) : (
                             <code className="bg-muted/50 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>{children}</code>
                           )
                         }
                      }}>
                        {displayNotes}
                      </Markdown>
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="py-2" style={{ width: columnWidths.tags }}>
                <div className="flex flex-wrap gap-1">
                  {item.tags?.map(tag => (
                    <span key={tag} className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded-none border border-border/20">
                      #{tag}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2 text-right px-2">
                <div className="flex justify-end gap-1">
                  <div 
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id) onEdit(item.id);
                    }}
                    className="p-1 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Edit item"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <div 
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id) onDelete(item.id);
                    }}
                    className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length === 0 && (
        <div className="p-20 text-center text-muted-foreground font-mono text-sm opacity-50 italic">
          No items found. Add something below.
        </div>
      )}
    </div>
  );
}
