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
import { User } from 'firebase/auth';

interface InventorySidebarProps {
  categories: string[];
  tags: string[];
  selectedCategory: string | null;
  selectedTag: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function InventorySidebar({ 
  categories, 
  tags, 
  selectedCategory, 
  selectedTag,
  onSelectCategory,
  onSelectTag,
  user,
  onLogin,
  onLogout
}: InventorySidebarProps) {
  return (
    <Sidebar className="border-r border-border/40 bg-muted/30">
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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono opacity-50">Inventory Items</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map(category => (
                <SidebarMenuItem key={category}>
                  <SidebarMenuButton 
                    isActive={selectedCategory === category}
                    onClick={() => onSelectCategory(category)}
                    className="font-mono text-xs"
                  >
                    <Folder className="w-4 h-4 mr-2" />
                    {category}
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
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] bg-primary/5 border border-primary/10">
                  <div className="w-6 h-6 rounded-none bg-primary/20 flex items-center justify-center shrink-0">
                    <UserIcon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-bold opacity-90">{user.displayName || user.email?.split('@')[0] || 'User'}</div>
                    <div className="truncate text-[9px] opacity-50 uppercase">{user.email ? 'Authorized' : 'Guest'}</div>
                  </div>
                </div>
                <SidebarMenuButton 
                  onClick={onLogout}
                  className="font-mono text-[10px] uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </SidebarMenuButton>
              </div>
            ) : (
              <SidebarMenuButton 
                onClick={onLogin}
                className="font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
