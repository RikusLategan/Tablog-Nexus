import React from 'react';
import { 
  Box, 
  Tag as TagIcon, 
  Folder, 
  Settings, 
  Shield, 
  Database,
  History,
  TrendingDown,
  Archive,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from '@/components/ui/sidebar';

interface InventorySidebarProps {
  categories: string[];
  tags: string[];
  selectedCategory: string | null;
  selectedTag: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onEditCategoryIcon?: (category: string) => void;
  inventory?: Record<string, number>;
  maxInventory?: Record<string, number>;
  categoryIcons?: Record<string, string>;
}

export function InventorySidebar({ 
  categories, 
  tags, 
  selectedCategory, 
  selectedTag,
  onSelectCategory,
  onSelectTag,
  onEditCategoryIcon,
  inventory,
  maxInventory,
  categoryIcons = {}
}: InventorySidebarProps) {
  return (
    <Sidebar collapsible="none" className="border-r border-border/40 bg-muted/30 h-full">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono opacity-50">Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={selectedCategory === null && selectedTag === null}
                  onClick={() => { onSelectCategory(null); onSelectTag(null); }}
                  className="font-mono text-xs"
                >
                  <Database className="w-4 h-4 mr-2" />
                  All Items
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="font-mono text-xs opacity-60 cursor-not-allowed">
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Low Stock
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="font-mono text-xs opacity-60 cursor-not-allowed">
                  <Archive className="w-4 h-4 mr-2" />
                  Archived
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono opacity-50">Items</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map(category => (
                <SidebarMenuItem key={category}>
                  <SidebarMenuButton 
                    isActive={selectedCategory === category}
                    onClick={() => onSelectCategory(category)}
                    className="font-mono text-xs flex items-center group relative h-9"
                  >
                    <div className="flex items-center truncate flex-1">
                      {categoryIcons[category] ? (
                        categoryIcons[category].startsWith('http') || categoryIcons[category].startsWith('data:image') ? (
                          <img src={categoryIcons[category]} alt="" className="w-4 h-4 mr-2 shrink-0 object-contain" />
                        ) : (
                          <span className="w-4 h-4 mr-2 shrink-0 flex items-center justify-center text-sm leading-none">{categoryIcons[category]}</span>
                        )
                      ) : (
                        <Folder className="w-4 h-4 mr-2 shrink-0" />
                      )}
                      <span className="truncate">{category}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 pr-1">
                      <span 
                        className={`text-[10px] tabular-nums ${
                          (inventory?.[category] || 0) < ((maxInventory?.[category] || 0) / 3)
                            ? 'text-red-500 font-bold'
                            : 'opacity-50'
                        }`}
                      >
                        {inventory?.[category] || 0}
                      </span>
                      {onEditCategoryIcon && (
                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCategoryIcon(category);
                          }}
                          title="Edit Icon"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono opacity-50">Tags</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tags.map(tag => (
                <SidebarMenuItem key={tag}>
                  <SidebarMenuButton 
                    isActive={selectedTag === tag}
                    onClick={() => onSelectTag(tag)}
                    className="font-mono text-xs"
                  >
                    <TagIcon className="w-4 h-4 mr-2" />
                    {tag}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] bg-primary/5 border border-primary/10">
                <div className="w-6 h-6 rounded-none bg-primary/20 flex items-center justify-center shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-bold opacity-90">Local User</div>
                  <div className="truncate text-[9px] opacity-50 uppercase">Offline Mode</div>
                </div>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
