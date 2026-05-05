import React from 'react';
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
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Trash2, ArrowUpDown, ChevronUp, ChevronDown, Pencil } from 'lucide-react';

interface InventoryTableProps {
  items: InventoryItem[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  sortConfig: { key: keyof InventoryItem | null, direction: 'asc' | 'desc' };
  onSort: (key: keyof InventoryItem) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

function getOrdinal(n: number) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
}

export function InventoryTable({ 
  items, 
  onDelete, 
  onEdit,
  sortConfig, 
  onSort, 
  selectedIds, 
  onSelectionChange,
  inventory,
  maxInventory
}: InventoryTableProps & { inventory: Record<string, number>, maxInventory: Record<string, number> }) {
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
    category: 200,
    quantity: 80,
    tags: 180,
    createdAt: 100,
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
      const baseTagsWidth = 180;
      
      // Try to shrink notes first, then tags if necessary
      let remainingToShrink = extraWidth;
      
      let newNotesWidth = baseNotesWidth;
      let newTagsWidth = baseTagsWidth;

      if (remainingToShrink > 0) {
        const notesShrink = Math.min(remainingToShrink, baseNotesWidth - 200);
        newNotesWidth -= notesShrink;
        remainingToShrink -= notesShrink;
      }

      if (remainingToShrink > 0) {
        const tagsShrink = Math.min(remainingToShrink, baseTagsWidth - 60);
        newTagsWidth -= tagsShrink;
      }

      if (prev.notes !== newNotesWidth || prev.tags !== newTagsWidth) {
        return { ...prev, notes: newNotesWidth, tags: newTagsWidth };
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

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };
  const SortIcon = ({ column }: { column: keyof InventoryItem }) => {
    if (!sortConfig || sortConfig.key !== column) return <ArrowUpDown className="ml-1 w-2.5 h-2.5 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 w-2.5 h-2.5 text-primary" /> : <ChevronDown className="ml-1 w-2.5 h-2.5 text-primary" />;
  };

  return (
    <div className="rounded-none border-b border-border/40">
      <Table className="table-fixed">
        <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/40">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-10 h-8 p-0 text-center">
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
              { label: 'Notes', key: 'notes', sortable: true, align: 'left' },
              { label: 'Item', key: 'category', sortable: true, align: 'left' },
              { label: 'Qty', key: 'quantity', sortable: true, align: 'left' },
              { label: 'Tags', key: 'tags', sortable: false, align: 'left' }
            ] as { label: string, key: string, sortable: boolean, align: 'left' | 'right' }[]).map((col) => (
              <TableHead 
                key={col.key}
                className={col.align === 'right' ? "p-0 h-8 text-right relative" : "p-0 h-8 relative"}
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
            <TableHead className="w-full p-0"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={`group border-b transition-colors border-border/20 cursor-pointer ${
                selectedIds.has(item.id!) 
                  ? 'bg-primary/10 border-l-2 border-l-primary' 
                  : 'hover:bg-primary/5'
              }`}
              onClick={() => toggleSelectItem(item.id!)}
            >
              <TableCell className="p-0">
                <div className="flex items-center justify-center h-full min-h-[40px]">
                  <Checkbox 
                    checked={selectedIds.has(item.id!)}
                    onCheckedChange={() => toggleSelectItem(item.id!)}
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
              <TableCell className="py-2 text-sm truncate text-foreground" style={{ width: columnWidths.notes }}>
                {item.notes}
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
