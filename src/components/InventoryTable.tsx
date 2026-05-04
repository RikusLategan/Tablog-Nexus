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
import { Trash2, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

interface InventoryTableProps {
  items: InventoryItem[];
  onDelete: (id: string) => void;
  sortConfig: { key: keyof InventoryItem | null, direction: 'asc' | 'desc' };
  onSort: (key: keyof InventoryItem) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function InventoryTable({ 
  items, 
  onDelete, 
  sortConfig, 
  onSort, 
  selectedIds, 
  onSelectionChange 
}: InventoryTableProps) {
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({
    notes: 250,
    category: 180,
    quantity: 70,
    unit: 70,
    tags: 150,
    createdAt: 140
  });

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
    if (!resizingRef.current) return;
    
    const deltaX = e.clientX - resizingRef.current.startX;
    const newWidth = Math.max(50, resizingRef.current.startWidth + deltaX);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingRef.current!.key]: newWidth
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
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 w-2.5 h-2.5 opacity-30" />;
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
            {[
              { label: 'Notes', key: 'notes', sortable: true },
              { label: 'Inventory Item', key: 'category', sortable: true },
              { label: 'Qty', key: 'quantity', sortable: true },
              { label: 'Unit', key: 'unit', sortable: true },
              { label: 'Tags', key: 'tags', sortable: false },
              { label: 'Logged At', key: 'createdAt', sortable: true, align: 'right' }
            ].map((col) => (
              <TableHead 
                key={col.key}
                className={col.align === 'right' ? "p-0 h-8 text-right relative" : "p-0 h-8 relative"}
                style={{ width: columnWidths[col.key] }}
              >
                <div className="flex items-center h-full relative group/header">
                  <div 
                    className={`flex-1 flex items-center px-2 font-mono text-[10px] uppercase tracking-wider h-full ${col.sortable ? 'cursor-pointer hover:bg-muted/80' : ''} ${col.align === 'right' ? 'justify-end' : ''}`}
                    onClick={() => col.sortable && onSort(col.key as keyof InventoryItem)}
                  >
                    {col.label} {col.sortable && <SortIcon column={col.key as keyof InventoryItem} />}
                  </div>
                  {/* Resize Handle */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-20"
                    onMouseDown={(e) => onMouseDown(col.key, e)}
                  />
                </div>
              </TableHead>
            ))}
            <TableHead className="w-10 p-0"></TableHead>
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
              <TableCell className="py-2 text-xs text-muted-foreground truncate italic" style={{ width: columnWidths.notes }}>
                {item.notes}
              </TableCell>
              <TableCell className="font-medium py-2 text-xs truncate" style={{ width: columnWidths.category }}>
                {item.category}
              </TableCell>
              <TableCell className="py-2 text-xs font-mono" style={{ width: columnWidths.quantity }}>
                <span className={item.quantity > 0 ? "text-emerald-500" : item.quantity < 0 ? "text-red-500" : ""}>
                  {Math.abs(item.quantity)}
                </span>
              </TableCell>
              <TableCell className="py-2 text-[10px] font-mono opacity-60 uppercase" style={{ width: columnWidths.unit }}>
                {item.unit || '---'}
              </TableCell>
              <TableCell className="py-2" style={{ width: columnWidths.tags }}>
                <div className="flex flex-wrap gap-1">
                  {item.tags?.map(tag => (
                    <span key={tag} className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded-none border border-border/20">
                      #{tag}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2 text-right text-[10px] font-mono text-muted-foreground" style={{ width: columnWidths.createdAt }}>
                {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : 'Pending...'}
              </TableCell>
              <TableCell className="py-2 text-right px-2">
                <div className="flex justify-end">
                  <div 
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id) onDelete(item.id);
                    }}
                    className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
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
          No inventory items found. Add something below.
        </div>
      )}
    </div>
  );
}
