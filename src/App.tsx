import React, { useState, useEffect, useMemo } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { InventorySidebar } from './components/InventorySidebar';
import { InventoryTable } from './components/InventoryTable';
import { LogEntryInput } from './components/LogEntryInput';
import { BulkEditSheet } from './components/BulkEditSheet';
import { inventoryService } from './services/inventoryService';
import { InventoryItem } from './types';
import { Search, Filter, Loader2, Info, LogIn, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { auth, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';

export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem | null, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('theme-nexus');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Apply theme and dark/light classes to document body
    document.documentElement.className = `${currentTheme} ${isDarkMode ? 'dark' : 'light'}`;
  }, [currentTheme, isDarkMode]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubscribe = inventoryService.subscribeToItems((newItems) => {
      setItems(newItems);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(item => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [items]);

  const tags = useMemo(() => {
    const tgs = new Set<string>();
    items.forEach(item => { item.tags?.forEach(t => tgs.add(t)); });
    return Array.from(tgs).sort();
  }, [items]);

  const units = useMemo(() => {
    const u = new Set<string>();
    items.forEach(item => { if (item.unit) u.add(item.unit); });
    return Array.from(u).sort();
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
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          comparison = aTime - bTime;
        } else {
          comparison = aValue > bValue ? 1 : -1;
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [items, search, selectedCategory, selectedTag, sortConfig]);

  const handleAddItem = async (data: any) => {
    if (!user) {
      alert("You must be signed in to add items.");
      return;
    }
    await inventoryService.addItem(data);
  };

  const handleDeleteItem = async (id: string) => {
    try {
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
      await inventoryService.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Bulk delete failed:", error);
    }
  };

  const handleBulkUpdate = async (updates: Partial<InventoryItem>) => {
    await inventoryService.bulkUpdate(Array.from(selectedIds), updates);
    setSelectedIds(new Set());
  };

  const handleSort = (key: keyof InventoryItem) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
        {/* Header Bar - Full Width snug Title */}
        <header className="h-10 border-b border-border/40 flex items-center justify-between px-4 bg-muted/10 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary opacity-80" />
            <h1 className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary/90 snug">
              Tablog: Personal Medication Journal
            </h1>
          </div>

          <div className="flex items-center gap-2">
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
                {isDarkMode ? 'DARK' : 'LIGHT'}
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input 
                placeholder="QUERY DATABASE..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-48 text-[13px] font-mono pl-7 rounded-none border-border/40 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
            
            {user && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 opacity-50 hover:opacity-100"
                onClick={handleLogout}
              >
                <LogOut className="w-3.5 h-3.5 text-destructive" />
              </Button>
            )}
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
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
          
          <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background border-l border-border/40">
            {/* Main Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
            {/* Main Area */}
            <main className="flex-1 overflow-auto">
            {!user ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
                <div className="p-4 rounded-full bg-primary/5 border border-primary/20">
                  <Shield className="w-12 h-12 text-primary/40" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-mono text-sm uppercase tracking-widest font-bold">Authentication Required</h2>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed opacity-70">
                    ACCESS TO THE NEXUS INVENTORY DATABASE IS RESTRICTED TO AUTHORIZED PERSONNEL. PLEASE INITIALIZE SECURITY HANDSHAKE.
                  </p>
                </div>
                <Button 
                  onClick={handleLogin}
                  className="rounded-none font-mono text-xs uppercase tracking-widest px-8"
                >
                  Start Handshake
                </Button>
              </div>
            ) : loading ? (
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
                        onClick={() => setIsBulkEditOpen(true)}
                        className="h-7 text-[10px] font-mono uppercase rounded-none border-primary/20 hover:bg-primary/10 px-3"
                      >
                        Bulk Edit
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkDelete}
                        className="h-7 text-[10px] font-mono uppercase rounded-none px-3"
                      >
                        Delete All
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedIds(new Set())}
                        className="h-7 text-[10px] font-mono uppercase rounded-none opacity-50 hover:opacity-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
                <div className="flex-1 overflow-auto">
                  <InventoryTable 
                    items={filteredItems} 
                    onDelete={handleDeleteItem}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                  />
                </div>
              </div>
            )}
          </main>

          <BulkEditSheet 
            isOpen={isBulkEditOpen}
            onOpenChange={setIsBulkEditOpen}
            selectedCount={selectedIds.size}
            onSave={handleBulkUpdate}
          />

          {/* Status/Command Bar */}
          <div className="shrink-0 flex flex-col">
            <div className="px-4 py-1 bg-muted/30 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
                  {user ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
                {user && (
                  <>
                    <span>ITEMS: {items.length}</span>
                    <span>FILTERED: {filteredItems.length}</span>
                  </>
                )}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase opacity-40">
                Ver: 1.0.5-Nexus
              </div>
            </div>
            <LogEntryInput 
              onAdd={handleAddItem} 
              knownItems={categories}
              knownUnits={units}
              lastUsedUnits={lastUsedUnits}
            />
          </div>
        </div>
      </SidebarInset>
      </div>
    </div>
  </SidebarProvider>
  );
}
