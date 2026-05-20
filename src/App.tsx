import React, { useState, useEffect, useMemo } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { InventorySidebar } from './components/InventorySidebar';
import { InventoryTable } from './components/InventoryTable';
import { LogEntryInput } from './components/LogEntryInput';
import { Timeline } from './components/Timeline';
import { inventoryService } from './services/inventoryService';
import { InventoryItem, UndoAction } from './types';
import { DataTransferDialog } from './components/DataTransferDialog';
import { DatabaseSelectScreen } from './components/DatabaseSelectScreen';
import { parseCustomTemplate, DEFAULT_CUSTOM_TEMPLATE, calculateDepths } from './lib/exportUtils';
import { Search, Filter, Loader2, Info, LogIn, LogOut, User as UserIcon, Shield, Undo, Redo, RotateCcw, RotateCw, Database, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem | null, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentTheme, setCurrentTheme] = useState('theme-nexus');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState<'dataset' | 'timeline'>('dataset');
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingCategoryIcon, setEditingCategoryIcon] = useState<string | null>(null);
  const [editingIconValue, setEditingIconValue] = useState('');

  useEffect(() => {
    // Apply theme and dark/light classes to document body
    document.documentElement.className = `${currentTheme} ${isDarkMode ? 'dark' : 'light'}`;
  }, [currentTheme, isDarkMode]);

  useEffect(() => {
    if (!dbReady) return;
    setLoading(true);
    const unsubscribe = inventoryService.subscribeToItems((newItems) => {
      setItems(newItems);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [dbReady]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(item => { if (item.category) cats.add(item.category); });
    const sortedCats = Array.from(cats).sort();
    
    // Ensure "(No Item)" is first
    const noItemIndex = sortedCats.indexOf("(No Item)");
    if (noItemIndex !== -1) {
      const removed = sortedCats.splice(noItemIndex, 1);
      sortedCats.unshift(removed[0]);
    }
    
    return sortedCats;
  }, [items]);

  const tags = useMemo(() => {
    const tgs = new Set<string>();
    items.forEach(item => { item.tags?.forEach(t => tgs.add(t)); });
    return Array.from(tgs).sort();
  }, [items]);

  const { inventoryCounts, maxInventoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const maxCounts: Record<string, number> = {};
    
    // Calculate chronologically to find the true max over time
    const sortedItems = [...items].sort((a, b) => {
      const aTime = (a.loggedAt ? a.loggedAt : a.createdAt)?.toDate?.()?.getTime() || 0;
      const bTime = (b.loggedAt ? b.loggedAt : b.createdAt)?.toDate?.()?.getTime() || 0;
      return aTime - bTime;
    });

    sortedItems.forEach(item => {
      if (item.category) {
        const change = item.quantity || 0;
        const current = counts[item.category] || 0;
        // Apply change and ensure it doesn't go below zero
        counts[item.category] = Math.max(0, current + change);
        
        if (counts[item.category] > (maxCounts[item.category] || 0)) {
          maxCounts[item.category] = counts[item.category];
        }
      }
    });

    return { inventoryCounts: counts, maxInventoryCounts: maxCounts };
  }, [items]);

  const units = useMemo(() => {
    const u = new Set<string>();
    items.forEach(item => { if (item.unit) u.add(item.unit); });
    return Array.from(u).sort();
  }, [items]);

  const categoryIcons = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach(item => {
      if (item.category && item.icon) {
        map[item.category] = item.icon;
      }
    });
    return map;
  }, [items]);

  const lastUsedUnits = useMemo(() => {
    const map: Record<string, string> = {};
    // Sort by date to get the most recent ones
    const sorted = [...items].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return aTime - bTime; // Oldest to newest
    });
    sorted.forEach(item => {
      if (item.category && item.unit) {
        map[item.category] = item.unit;
      }
    });
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesSearch = (item.category?.toLowerCase().includes(search.toLowerCase()) || 
                            item.notes?.toLowerCase().includes(search.toLowerCase()));
      const matchesCat = !selectedCategory || item.category === selectedCategory;
      const matchesTag = !selectedTag || item.tags?.includes(selectedTag);
      return matchesSearch && matchesCat && matchesTag;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === bValue) return 0;
        
        let comparison = 0;
        if (sortConfig.key === 'createdAt') {
          const aTime = (a.loggedAt || a.createdAt)?.toMillis?.() || 0;
          const bTime = (b.loggedAt || b.createdAt)?.toMillis?.() || 0;
          comparison = aTime - bTime;
        } else {
          comparison = aValue > bValue ? 1 : -1;
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    const itemsMap = new Map();
    result.forEach(i => itemsMap.set(i.id, i));
    
    const childrenByParent = new Map();
    result.forEach(item => {
      if (item.parentId && itemsMap.has(item.parentId)) {
        if (!childrenByParent.has(item.parentId)) {
          childrenByParent.set(item.parentId, []);
        }
        childrenByParent.get(item.parentId).push(item);
      }
    });

    const grouped: typeof result = [];
    const visited = new Set();
    for (const item of result) {
      const isTopLevel = !item.parentId || !itemsMap.has(item.parentId);
      if (isTopLevel && !visited.has(item.id)) {
        grouped.push(item);
        visited.add(item.id);
        
        const addChildren = (parentId: string) => {
          const children = childrenByParent.get(parentId) || [];
          for (const child of children) {
            if (!visited.has(child.id)) {
              grouped.push(child);
              visited.add(child.id);
              if (child.id) addChildren(child.id);
            }
          }
        };
        if (item.id) addChildren(item.id);
      }
    }

    return grouped;
  }, [items, search, selectedCategory, selectedTag, sortConfig]);

  const handleAddItem = async (data: any, id?: string) => {
    if (!id && data.notes?.trim().toLowerCase() === "wake up") {
      const sleepEntry = items
        .filter(i => i.notes?.trim().toLowerCase() === "sleep" && (i.loggedAt || i.createdAt))
        .sort((a, b) => {
            const aTime = (b.loggedAt || b.createdAt)?.toMillis?.() || 0;
            const bTime = (a.loggedAt || a.createdAt)?.toMillis?.() || 0;
            return aTime - bTime;
        })[0];
      
      if (sleepEntry) {
        const sleepTime = (sleepEntry.loggedAt || sleepEntry.createdAt)?.toMillis?.() || 0;
        const wakeTime = data.loggedAt?.getTime() || Date.now();
        if (wakeTime > sleepTime) {
          const diff = wakeTime - sleepTime;
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          data.notes = `Wake up (${hrs}h${mins}min)`;
          
          if (sleepEntry.id) {
             inventoryService.updateItem(sleepEntry.id, {
                isStopwatchPaused: true,
                stopwatchElapsedMs: diff,
                taskStatus: 'DONE'
             }).catch(console.error);
          }
        }
      }
    }

    if (id) {
      // Update Mode
      const previousItem = items.find(i => i.id === id);
      if (previousItem) {
        const action: UndoAction = { 
          type: 'UPDATE', 
          id, 
          previousData: { 
            category: previousItem.category,
            quantity: previousItem.quantity,
            notes: previousItem.notes,
            tags: previousItem.tags,
            taskStatus: previousItem.taskStatus,
            loggedAt: previousItem.loggedAt,
            unit: previousItem.unit
          },
          newData: data
        };
        setUndoStack(prev => [...prev, action]);
        setRedoStack([]);
        setShowUndoToast(true);
      }
      await inventoryService.updateItem(id, data);
      setSelectedIds(new Set()); // Clear selection after save
    } else {
      // Add Mode
      const newId = await inventoryService.addItem(data);
      if (newId) {
        const fullItem: InventoryItem = {
          ...data,
          id: newId,
          userId: 'local-user',
          createdAt: { toDate: () => data.loggedAt || new Date() } as any
        };
        setUndoStack(prev => [...prev, { type: 'ADD', id: newId, item: fullItem }]);
        setRedoStack([]);
        setShowUndoToast(true);
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const itemToDelete = items.find(i => i.id === id);
      if (itemToDelete) {
        setUndoStack(prev => [...prev, { type: 'DELETE', item: { ...itemToDelete } }]);
        setRedoStack([]);
        setShowUndoToast(true);
      }
      await inventoryService.deleteItem(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const idsToDelete = Array.from(selectedIds) as string[];
      const itemsToStore = items.filter(i => i.id && idsToDelete.includes(i.id));
      
      setUndoStack(prev => [...prev, { type: 'BULK_DELETE', items: [...itemsToStore] }]);
      setRedoStack([]);
      setShowUndoToast(true);

      await inventoryService.bulkDelete(idsToDelete);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Bulk delete failed:", error);
    }
  };

  const handleExportSelected = async () => {
    const selectedData = filteredItems.filter(i => i.id && selectedIds.has(i.id));
    if (selectedData.length === 0) return;
    
    // Reverse the data to be chronological? Or keep it as presented in filteredItems?
    // Often you want exports in chronological order or you can just respect the filteredItems order.
    // The previous implementation mapped them sequentially, let's just map selectedData.
    const content = calculateDepths(selectedData, items)
      .map(({item, depth}, idx) => parseCustomTemplate(item, DEFAULT_CUSTOM_TEMPLATE, idx, depth))
      .join('\n');
    
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `inventory_export_${new Date().toISOString().split('T')[0]}.txt`,
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Failed to save file:', error);
      }
    }
    
    setSelectedIds(new Set());
  };

  const handleToggleStopwatch = async (item: InventoryItem, isPaused: boolean, currentElapsedMs: number, resumedAt: number) => {
    if (!item.id) return;
    try {
      const updates: Partial<InventoryItem> = {
        isStopwatchPaused: isPaused,
        stopwatchElapsedMs: currentElapsedMs,
        stopwatchLastResumedAt: resumedAt
      };
      
      if (isPaused) {
        updates.taskStatus = 'DONE';
        updates.stopwatchLastPausedAt = Date.now();
      } else {
        updates.taskStatus = 'NOW';
      }

      await inventoryService.updateItem(item.id, updates);
    } catch (error) {
      console.error("Toggle stopwatch failed:", error);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    try {
      switch (action.type) {
        case 'ADD':
          await inventoryService.deleteItem(action.id);
          break;
        case 'DELETE':
          await inventoryService.restoreItem(action.item);
          break;
        case 'BULK_DELETE':
          for (const item of action.items) {
            await inventoryService.restoreItem(item);
          }
          break;
        case 'UPDATE':
          await inventoryService.updateItem(action.id, action.previousData);
          break;
      }
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, action]);
      setShowUndoToast(false);
    } catch (error) {
      console.error("Undo failed:", error);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    try {
      switch (action.type) {
        case 'ADD':
          await inventoryService.restoreItem(action.item);
          break;
        case 'DELETE':
          if (action.item.id) await inventoryService.deleteItem(action.item.id);
          break;
        case 'BULK_DELETE': {
          const ids = action.items.map(i => i.id).filter(Boolean) as string[];
          await inventoryService.bulkDelete(ids);
          break;
        }
        case 'UPDATE':
          await inventoryService.updateItem(action.id, action.newData);
          break;
      }
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, action]);
    } catch (error) {
      console.error("Redo failed:", error);
    }
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check for focused input to avoid conflicting with typing, 
      // but usually apps allow Ctrl+Z anywhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
          return;
        }
        if (window.getSelection() && window.getSelection()!.toString().length > 0) {
          return;
        }
        if (selectedIds.size > 0) {
          e.preventDefault();
          const selectedData = filteredItems.filter(i => i.id && selectedIds.has(i.id));
          if (selectedData.length === 0) return;
          const content = calculateDepths(selectedData, items)
            .map(({item, depth}, idx) => parseCustomTemplate(item, DEFAULT_CUSTOM_TEMPLATE, idx, depth))
            .join('\n');
          try {
            await navigator.clipboard.writeText(content);
          } catch(err) {
            console.error('Failed to copy to clipboard', err);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, selectedIds, filteredItems]);

  const handleEditItem = (id: string) => {
    setSelectedIds(new Set([id]));
  };

  const editingItem = useMemo(() => {
    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0] as string;
      return items.find(item => item.id === id);
    }
    return null;
  }, [selectedIds, items]);

  const handleSort = (key: keyof InventoryItem) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (!dbReady) {
    return <DatabaseSelectScreen onReady={() => setDbReady(true)} />;
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
        {/* Header Bar - Full Width snug Title */}
        <header className="h-10 border-b border-border/40 flex items-center justify-between px-4 bg-muted/10 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary opacity-80" />
            <h1 className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary/90 snug mr-4">
              Tablog: Personal Medication Journal
            </h1>
            
            {/* View Switcher */}
            <div className="flex items-center bg-background/50 border border-border/40 p-0.5">
              <button 
                onClick={() => setCurrentView('dataset')}
                className={`px-3 h-6 text-[10px] font-mono uppercase tracking-widest transition-colors ${currentView === 'dataset' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 text-muted-foreground'}`}
              >
                Dataset
              </button>
              <button 
                onClick={() => setCurrentView('timeline')}
                className={`px-3 h-6 text-[10px] font-mono uppercase tracking-widest transition-colors ${currentView === 'timeline' ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 text-muted-foreground'}`}
              >
                Timeline
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo Controls */}
            <div className="flex items-center gap-0.5 mr-2">
              <button 
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Theme & Mode Selector */}
            <div className="flex items-center gap-1 border border-border/40 bg-background/50 p-0.5">
               <select 
                value={currentTheme}
                onChange={(e) => setCurrentTheme(e.target.value)}
                className="bg-transparent text-[10px] font-mono uppercase tracking-wider outline-none cursor-pointer px-2 h-6"
              >
                <option value="theme-nexus">Nexus / Amber</option>
                <option value="theme-matrix">Matrix / Green</option>
                <option value="theme-swiss">Swiss / Neo</option>
                <option value="theme-classic">Classic / Serif</option>
                <option value="theme-cyberpunk">Cyber / Neon</option>
              </select>
              <div className="w-px h-3 bg-border/40 mx-1" />
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="px-2 h-6 flex items-center justify-center hover:bg-primary/10 text-[10px] uppercase font-mono tracking-widest"
              >
                {isDarkMode ? 'Dark' : 'Light'}
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input 
                placeholder="Query database..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-48 text-[13px] font-mono pl-7 rounded-none border-border/40 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>

            <Button 
              variant="outline" 
              size="icon" 
              className="h-7 w-7 rounded-none"
              onClick={() => setTransferOpen(true)}
              title="Database Management"
            >
              <Database className="w-3.5 h-3.5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-none ml-2"
              onClick={async () => {
                await inventoryService.disconnect();
                setDbReady(false);
              }}
              title="Close Database"
            >
              <LogOut className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <InventorySidebar 
            categories={categories}
            tags={tags}
            selectedCategory={selectedCategory}
            selectedTag={selectedTag}
            onSelectCategory={category => { setSelectedCategory(category); setSelectedTag(null); }}
            onSelectTag={tag => { setSelectedTag(tag); setSelectedCategory(null); }}
            onEditCategoryIcon={(cat) => {
               setEditingCategoryIcon(cat);
               // Find existing icon if any
               const existing = items.find(i => i.category === cat && i.icon);
               setEditingIconValue(existing?.icon || '');
            }}
            inventory={inventoryCounts}
            maxInventory={maxInventoryCounts}
            categoryIcons={categoryIcons}
          />
          
          <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background border-l border-border/40">
            {/* Main Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden relative">
              
              {/* Category Icon Edit Modal */}
              <AnimatePresence>
                {editingCategoryIcon && (
                   <motion.div 
                     initial={{ opacity: 0, y: -10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-background border border-primary/40 shadow-xl p-4 flex flex-col gap-3 w-80"
                   >
                     <div className="flex justify-between items-center bg-muted/20 p-2 border border-border/40">
                       <span className="text-[10px] uppercase font-mono tracking-widest text-primary shrink-0 mr-2">Edit Icon</span>
                       <span className="font-bold text-sm truncate">{editingCategoryIcon}</span>
                     </div>
                     <Input 
                       placeholder="Emoji or Image URL" 
                       value={editingIconValue}
                       onChange={e => setEditingIconValue(e.target.value)}
                       className="h-8 font-mono text-sm"
                       autoFocus
                     />
                     <div className="flex gap-2 justify-end">
                       <Button 
                         variant="ghost" 
                         className="h-7 text-xs uppercase rounded-none"
                         onClick={() => setEditingCategoryIcon(null)}
                       >
                         Cancel
                       </Button>
                       <Button 
                         variant="default" 
                         className="h-7 text-xs uppercase rounded-none"
                         onClick={async () => {
                           // Update all items in this category
                           const ids = items.filter(i => i.category === editingCategoryIcon).map(i => i.id!);
                           await inventoryService.bulkUpdate(ids, { icon: editingIconValue.trim() || undefined });
                           setEditingCategoryIcon(null);
                         }}
                       >
                         Save
                       </Button>
                     </div>
                   </motion.div>
                )}
              </AnimatePresence>
            {/* Main Area */}
            <main className="flex-1 relative overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center gap-2 font-mono text-xs opacity-50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Accessing Central Database...
              </div>
            ) : (
              <div className="flex flex-col h-full relative">
                {selectedIds.size > 0 && (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-primary/30 py-2 px-6 shadow-2xl flex items-center gap-6"
                  >
                    <div className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
                      {selectedIds.size} ITEMS SELECTED
                    </div>
                    <div className="h-4 w-px bg-primary/20" />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportSelected}
                        className="h-7 text-[10px] font-mono uppercase rounded-none px-3 bg-transparent border-primary/30 hover:bg-primary/10 hover:text-primary"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Export
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkDelete}
                        className="h-7 text-[10px] font-mono uppercase rounded-none px-3"
                      >
                        Delete {selectedIds.size > 1 ? 'All' : 'Item'}
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedIds(new Set())}
                        className="h-7 text-[10px] font-mono uppercase rounded-none opacity-50 hover:opacity-100"
                      >
                        Clear
                      </Button>
                    </div>
                  </motion.div>
                )}
                <div className="flex-1 overflow-auto">
                  {currentView === 'timeline' ? (
                    <Timeline items={filteredItems} />
                  ) : (
                    <InventoryTable 
                      items={filteredItems} 
                      allItems={items}
                      onDelete={handleDeleteItem}
                      onEdit={handleEditItem}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      onToggleStopwatch={handleToggleStopwatch}
                      inventory={inventoryCounts}
                      maxInventory={maxInventoryCounts}
                    />
                  )}
                </div>
              </div>
            )}
          </main>

          {/* Status/Command Bar */}
          <div className="shrink-0 flex flex-col relative">
            <AnimatePresence>
              {showUndoToast && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="fixed bottom-4 left-4 z-50 flex items-center gap-3 bg-zinc-900 border border-primary/30 py-2 px-4 shadow-xl"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Action performed
                  </span>
                  <div className="w-px h-3 bg-border/40" />
                  <button 
                    onClick={handleUndo}
                    className="group flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 transition-transform group-hover:-rotate-45" />
                    Undo
                  </button>
                  <button 
                    onClick={() => setShowUndoToast(false)}
                    className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 hover:text-foreground px-1"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <LogEntryInput 
              onAdd={handleAddItem} 
              knownItems={categories}
              knownUnits={units}
              lastUsedUnits={lastUsedUnits}
              editingItem={editingItem}
              onCancelEdit={() => setSelectedIds(new Set())}
            />
          </div>
        </div>
      </SidebarInset>
      </div>
    </div>
    <DataTransferDialog open={transferOpen} onOpenChange={setTransferOpen} items={items} selectedIds={selectedIds} />
  </SidebarProvider>
  );
}
