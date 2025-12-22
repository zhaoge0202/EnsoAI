import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from '@/components/ui/select';
import { Search, Plus, FolderOpen, Settings, Sparkles, PanelLeftClose } from 'lucide-react';
import type { WorkspaceRecord } from '@shared/types';

interface WorkspaceSidebarProps {
  workspaces: WorkspaceRecord[];
  currentWorkspace: WorkspaceRecord | null;
  repositories: Array<{ name: string; path: string }>;
  selectedRepo: string | null;
  onSelectWorkspace: (workspace: WorkspaceRecord) => void;
  onSelectRepo: (repoPath: string) => void;
  onAddRepository: () => void;
  width?: number;
  collapsed?: boolean;
  onCollapse?: () => void;
}

export function WorkspaceSidebar({
  workspaces,
  currentWorkspace,
  repositories,
  selectedRepo,
  onSelectWorkspace,
  onSelectRepo,
  onAddRepository,
  width = 280,
  collapsed = false,
  onCollapse,
}: WorkspaceSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWorkspaceChange = (value: string | null) => {
    if (!value) return;
    const workspace = workspaces.find((w) => String(w.id) === value);
    if (workspace) onSelectWorkspace(workspace);
  };

  return (
    <aside
      className="flex h-full w-full flex-col border-r bg-muted/30"
    >
      {/* Top bar with collapse button - h-12 to align with WorktreePanel header */}
      <div className="flex h-12 shrink-0 items-center justify-end px-2 drag-region">
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 no-drag"
            onClick={onCollapse}
            title="折叠"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Workspaces
        </span>
      </div>

      {/* Workspace Selector */}
      <div className="px-3 pb-3">
        <Select value={currentWorkspace ? String(currentWorkspace.id) : ''} onValueChange={handleWorkspaceChange}>
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <SelectValue>{currentWorkspace?.name || 'Personal'}</SelectValue>
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs">
                {repositories.length}
              </span>
            </div>
          </SelectTrigger>
          <SelectPopup>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={String(ws.id)}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  {ws.name}
                </div>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Repository List */}
      <div className="flex-1 overflow-auto px-2">
        <div className="space-y-1">
          {filteredRepos.map((repo) => (
            <button
              key={repo.path}
              onClick={() => onSelectRepo(repo.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                selectedRepo === repo.path
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50'
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{repo.name}</div>
                <div className="truncate text-xs text-muted-foreground">{repo.path}</div>
              </div>
            </button>
          ))}
        </div>

        {filteredRepos.length === 0 && searchQuery && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            没有找到匹配的仓库
          </div>
        )}

        {repositories.length === 0 && !searchQuery && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">选择项目</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button className="flex items-center gap-1.5 hover:text-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Become Pro · Support Aizen</span>
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t p-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={onAddRepository}
          >
            <Plus className="h-4 w-4" />
            Add Repository
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
