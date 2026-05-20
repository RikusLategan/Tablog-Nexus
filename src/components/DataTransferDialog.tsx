import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InventoryItem } from '../types';
import { inventoryService } from '../services/inventoryService';
import { Download, Upload, FileText, Database } from 'lucide-react';
import { parseCustomTemplate, DEFAULT_CUSTOM_TEMPLATE, calculateDepths } from '../lib/exportUtils';

interface DataTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  selectedIds: Set<string>;
}

export function DataTransferDialog({ open, onOpenChange, items, selectedIds }: DataTransferDialogProps) {
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [format, setFormat] = useState<string>('json');
  const [customTemplate, setCustomTemplate] = useState<string>(DEFAULT_CUSTOM_TEMPLATE);
  const importInputRef = useRef<HTMLInputElement>(null);

  const getExportItems = () => {
    if (scope === 'selected' && selectedIds.size > 0) {
      return items.filter(i => i.id && selectedIds.has(i.id));
    }
    return items;
  };

  const handleExport = async () => {
    const data = getExportItems();
    let content = '';
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'json') {
      const exportable = data.map(item => ({
        ...item,
        createdAt: (item.createdAt as any)?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: (item.updatedAt as any)?.toDate?.()?.toISOString() || new Date().toISOString(),
        loggedAt: (item.loggedAt as any)?.toDate?.()?.toISOString() || undefined
      }));
      content = JSON.stringify(exportable, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else if (format === 'csv') {
      const headers = ['id', 'category', 'quantity', 'notes', 'tags', 'createdAt', 'updatedAt', 'loggedAt'];
      const rows = data.map(item => [
        item.id || '',
        `"${(item.category || '').replace(/"/g, '""')}"`,
        item.quantity || '',
        `"${(item.notes || '').replace(/"/g, '""')}"`,
        `"${(item.tags || []).join(', ')}"`,
        (item.createdAt as any)?.toDate?.()?.toISOString() || '',
        (item.updatedAt as any)?.toDate?.()?.toISOString() || '',
        (item.loggedAt as any)?.toDate?.()?.toISOString() || '',
      ].join(','));
      content = [headers.join(','), ...rows].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else if (format === 'markdown') {
      content = '| Category | Quantity | Note | Tags | Date |\n|---|---|---|---|---|\n';
      content += data.map(item => {
        const d = item.loggedAt?.toDate?.() || item.createdAt?.toDate?.();
        const dateStr = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
        return `| ${item.category || ''} | ${item.quantity || ''} | ${(item.notes || '').replace(/\n/g, ' ')} | ${(item.tags || []).join(', ')} | ${dateStr} |`;
      }).join('\n');
      mime = 'text/markdown';
      ext = 'md';
    } else if (format === 'logseq') {
      content = data.map(item => {
        return `- ${item.category || 'Unnamed'}\n  quantity:: ${item.quantity || ''}\n  notes:: ${item.notes || ''}\n  tags:: ${item.tags?.map(t => `#${t}`).join(' ') || ''}`;
      }).join('\n');
      mime = 'text/markdown';
      ext = 'md';
    } else if (format === 'custom') {
      content = calculateDepths(data, items).map(({item, depth}, idx) => parseCustomTemplate(item, customTemplate, idx, depth)).join('\n');
      mime = 'text/plain';
      ext = 'txt';
    } else if (format === 'text') {
      content = data.map(item => `Category: ${item.category || ''}\nQuantity: ${item.quantity || ''}\nNote: ${item.notes || ''}\nTags: ${(item.tags || []).join(', ')}`).join('\n---\n');
      mime = 'text/plain';
      ext = 'txt';
    }

    let typeDescription = 'Text Files';
    if (ext === 'json') typeDescription = 'JSON Files';
    if (ext === 'csv') typeDescription = 'CSV Files';
    if (ext === 'md') typeDescription = 'Markdown Files';

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `inventory_export_${new Date().toISOString().split('T')[0]}.${ext}`,
          types: [{
            description: typeDescription,
            accept: { [mime]: [`.${ext}`] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Failed to save file:', error);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let importedItems: any[] = [];

        // Try JSON format first (for structured importing)
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                importedItems = parsed;
            } else if (parsed && typeof parsed === 'object') {
                importedItems = [parsed];
            }
        } catch (je) {
            // Not JSON, do a naive CSV/Text fallback parse
            if (file.name.endsWith('.csv') || text.includes(',')) {
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    const catIdx = headers.indexOf('category');
                    const qtyIdx = headers.indexOf('quantity');
                    const notesIdx = headers.indexOf('notes');
                    const tagIdx = headers.indexOf('tags');
                    
                    if (catIdx !== -1) {
                        for (let i = 1; i < lines.length; i++) {
                            // simple split, does not handle commas inside quotes properly but good enough for a basic fallback
                            const splitMatch = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                            const parts = lines[i].split(',');
                            
                            const cat = (parts[catIdx] || '').replace(/^"|"$/g, '');
                            if (!cat) continue;
                            
                            importedItems.push({
                                category: cat,
                                quantity: qtyIdx !== -1 ? Number(parts[qtyIdx]) || 1 : 1,
                                notes: notesIdx !== -1 ? (parts[notesIdx] || '').replace(/^"|"$/g, '') : '',
                                tags: tagIdx !== -1 ? (parts[tagIdx] || '').replace(/^"|"$/g, '').split(',').map(t=>t.trim()).filter(Boolean) : []
                            });
                        }
                    }
                }
            } else {
                // Naive text parser - try to extract line by line
                const lines = text.split('\n');
                let curItem: any = null;
                for (const line of lines) {
                    if (line.match(/^Category:\s*(.+)$/i) || line.match(/^- \[\[(.*?)\]\]/) || line.match(/^- (.*)$/)) {
                        if (curItem && curItem.category) importedItems.push(curItem);
                        const match = line.match(/^Category:\s*(.+)$/i) || line.match(/^- \[\[(.*?)\]\]/) || line.match(/^- (.*)$/);
                        curItem = { category: match ? match[1].trim() : "Unknown", quantity: 1, tags: [], notes: '' };
                    } else if (curItem) {
                        if (line.match(/quantity::?\s*(\d+)/i) || line.match(/^Quantity:\s*(\d+)/i)) {
                            const qm = line.match(/quantity::?\s*(\d+)/i) || line.match(/^Quantity:\s*(\d+)/i);
                            curItem.quantity = parseInt(qm![1]);
                        } else if (line.match(/tags::?\s*(.+)/i) || line.match(/^Tags:\s*(.+)/i)) {
                            const tm = line.match(/tags::?\s*(.+)/i) || line.match(/^Tags:\s*(.+)/i);
                            curItem.tags = tm![1].replace(/#/g, '').split(/[ ,]+/).map((t: string)=>t.trim()).filter(Boolean);
                        } else if (line.match(/note(?:s)?::?\s*(.+)/i) || line.match(/^Note(?:s)?:\s*(.+)/i)) {
                            const nm = line.match(/note(?:s)?::?\s*(.+)/i) || line.match(/^Note(?:s)?:\s*(.+)/i);
                            curItem.notes = nm![1].trim();
                        } else if (line.trim().length > 0 && !line.match(/^---$/)) {
                            curItem.notes = curItem.notes ? curItem.notes + '\n' + line.trim() : line.trim();
                        }
                    }
                }
                if (curItem && curItem.category) importedItems.push(curItem);
            }
        }

        if (importedItems.length > 0) {
            await inventoryService.importItems(importedItems, true);
            alert(`Imported ${importedItems.length} items successfully.`);
            onOpenChange(false);
        } else {
            alert('Could not parse any items from the file.');
        }

      } catch (err) {
        alert('Failed to read file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleSaveDB = () => {
      setFormat('json');
      setScope('all');
      setTimeout(() => handleExport(), 0);
  };
  
  const handleLoadDB = () => {
      importInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border-border/40 rounded-none bg-background/95 backdrop-blur font-mono text-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg uppercase tracking-widest text-primary flex items-center gap-2">
            <Database className="w-5 h-5" /> Data Transfer
          </DialogTitle>
          <DialogDescription className="font-mono text-xs opacity-70">
            Export or import inventory data, backup to disk, or restore.
          </DialogDescription>
        </DialogHeader>

        <input 
            type="file" 
            ref={importInputRef} 
            className="hidden" 
            onChange={handleFileUpload} 
        />

        <div className="grid grid-cols-2 gap-4 my-4">
            <Button variant="outline" className="rounded-none border-border/40 h-16 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={handleSaveDB}>
                <Download className="w-5 h-5" />
                <span>Save Database</span>
            </Button>
            <Button variant="outline" className="rounded-none border-border/40 h-16 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:text-primary hover:border-primary/50" onClick={handleLoadDB}>
                <Upload className="w-5 h-5" />
                <span>Load Database</span>
            </Button>
        </div>

        <Tabs defaultValue="export" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 rounded-none bg-primary/5 h-10 border border-primary/20 p-1">
            <TabsTrigger value="export" className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Export</TabsTrigger>
            <TabsTrigger value="import" className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Import</TabsTrigger>
          </TabsList>
          
          <TabsContent value="export" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-primary/70">Scope</label>
                <div className="flex gap-2">
                  <Button 
                    variant={scope === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setScope('all')}
                    className="rounded-none flex-1 text-xs"
                  >
                    Entire Database
                  </Button>
                  <Button 
                    variant={scope === 'selected' ? 'default' : 'outline'} 
                    size="sm" 
                    disabled={selectedIds.size === 0}
                    onClick={() => setScope('selected')}
                    className="rounded-none flex-1 text-xs"
                  >
                    Selected ({selectedIds.size})
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-primary/70">Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="w-full rounded-none font-mono">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none font-mono">
                    <SelectItem value="json">JSON (Full DB)</SelectItem>
                    <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="markdown">Markdown Table</SelectItem>
                    <SelectItem value="logseq">Logseq Graph (MD)</SelectItem>
                    <SelectItem value="custom">Custom Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {format === 'custom' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-widest text-primary/70">Template</label>
                  <div className="text-[10px] text-muted-foreground opacity-70 mb-1">
                    Available variables: <br/>
                    entry[n].item, entry[n].qty, entry[n].notes,<br/>
                    entry[n].year.YYYY, entry[n].month.MM, entry[n].day.DD,<br/>
                    entry[n].time.HH, entry[n].time.MM, entry[n].tag[1], etc.
                  </div>
                  <Textarea 
                    value={customTemplate}
                    onChange={(e) => setCustomTemplate(e.target.value)}
                    className="font-mono text-xs min-h-[120px] rounded-none border-border/40 focus-visible:ring-1 focus-visible:ring-primary/50"
                  />
                </div>
              )}

              <Button onClick={handleExport} className="w-full rounded-none font-mono tracking-widest uppercase">
                <FileText className="w-4 h-4 mr-2" />
                Generate Export
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4 pt-4">
             <div className="text-sm opacity-80 p-4 border border-border/40 bg-muted/5">
                 Import supports JSON, CSV, Logseq snippets, and generic PlainText blocks. <br/><br/>
                 Click below or use the "Load Database" button above for importing standard files.
             </div>
             <Button onClick={() => importInputRef.current?.click()} className="w-full rounded-none font-mono tracking-widest uppercase" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Select File to Import
              </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
