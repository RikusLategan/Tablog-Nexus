import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inventoryService } from '../services/inventoryService';
import { Database, FileUp, Plus } from 'lucide-react';

export function DatabaseSelectScreen({ onReady }: { onReady: () => void }) {
  const [hasSaved, setHasSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryService.hasSavedHandle().then(setHasSaved);
  }, []);

  const handleOpenSaved = async () => {
    try {
      if (await inventoryService.loadSavedHandle()) {
        onReady();
      } else {
        setError("Could not resume database connection. Please re-open it manually.");
      }
    } catch(e) {
      setError("Error resuming database connection.");
    }
  };

  const handleCreate = async () => {
    try {
      await inventoryService.createDatabase();
      onReady();
    } catch(e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    }
  }

  const handleOpen = async () => {
    try {
      await inventoryService.openDatabase();
      onReady();
    } catch(e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    }
  }

  const handleRestoreBackup = async () => {
    try {
      if (await inventoryService.restoreDailyBackup()) {
        onReady();
      } else {
        setError("No backup exists yet.");
      }
    } catch(e: any) {
      setError(e.message || "Error restoring backup.");
    }
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-4 z-50">
      <div className="max-w-md w-full space-y-8 text-center border border-border/40 p-8 rounded-none bg-card">
        <div className="flex justify-center mb-4">
          <Database className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-3xl font-mono font-bold text-foreground">TabLog Database</h1>
        <p className="text-muted-foreground font-mono text-sm">Choose a local database file to continue. Data is securely autosaved to your local disk.</p>
        
        <div className="space-y-4 pt-4">
          {hasSaved && (
            <Button onClick={handleOpenSaved} className="w-full font-mono rounded-none group relative">
              Resume Previous Database
            </Button>
          )}
          <Button onClick={handleOpen} variant="outline" className="w-full font-mono rounded-none text-foreground border-border/40">
            <FileUp className="w-4 h-4 mr-2" />
            Open Existing File
          </Button>
          <Button onClick={handleCreate} variant="secondary" className="w-full font-mono rounded-none">
            <Plus className="w-4 h-4 mr-2" />
            Create New Database
          </Button>

          <Button onClick={handleRestoreBackup} variant="ghost" className="w-full font-mono rounded-none text-xs text-muted-foreground mt-8">
            Recover Last Daily Backup
          </Button>
        </div>

        {error && <p className="text-destructive font-mono text-xs mt-4">{error}</p>}
      </div>
    </div>
  );
}
