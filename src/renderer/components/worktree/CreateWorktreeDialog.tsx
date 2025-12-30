import type {
  GhCliStatus,
  GitBranch as GitBranchType,
  PullRequest,
  WorktreeCreateOptions,
} from '@shared/types';
import { AlertCircle, GitBranch, GitPullRequest, Loader2, Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSeparator,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';

// Get display name for branch (remove remotes/ prefix for remote branches)
const getBranchDisplayName = (name: string) => {
  return name.startsWith('remotes/') ? name.replace('remotes/', '') : name;
};

interface CreateWorktreeDialogProps {
  branches: GitBranchType[];
  projectName: string;
  workdir: string;
  isLoading?: boolean;
  onSubmit: (options: WorktreeCreateOptions) => Promise<void>;
  trigger?: React.ReactElement;
}

type CreateMode = 'branch' | 'pr';

export function CreateWorktreeDialog({
  branches,
  projectName,
  workdir,
  isLoading,
  onSubmit,
  trigger,
}: CreateWorktreeDialogProps) {
  const { t } = useI18n();
  const { defaultWorktreePath } = useSettingsStore();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<CreateMode>('branch');
  const [baseBranch, setBaseBranch] = React.useState<string>('');
  const [newBranchName, setNewBranchName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // PR mode state
  const [ghStatus, setGhStatus] = React.useState<GhCliStatus | null>(null);
  const [ghStatusLoading, setGhStatusLoading] = React.useState(false);
  const [pullRequests, setPullRequests] = React.useState<PullRequest[]>([]);
  const [prsLoading, setPrsLoading] = React.useState(false);
  const [selectedPr, setSelectedPr] = React.useState<PullRequest | null>(null);

  // Worktree path: {defaultWorktreePath}/{projectName}/{branchName}
  // Falls back to ~/ensoai/workspaces if not configured
  const home = window.electronAPI?.env?.HOME || '';
  const isWindows = window.electronAPI?.env?.platform === 'win32';
  const pathSep = isWindows ? '\\' : '/';
  const getWorktreePath = (branchName: string) => {
    if (!home) return '';
    // Extract last directory name from projectName when a full path is passed in.
    const normalizedName = projectName.replace(/\\/g, '/');
    const projectBaseName = normalizedName.split('/').filter(Boolean).pop() || projectName;

    // Use configured path or default to ~/ensoai/workspaces
    const basePath = defaultWorktreePath || [home, 'ensoai', 'workspaces'].join(pathSep);
    return [basePath, projectBaseName, branchName].join(pathSep);
  };

  // Branch item type for combobox
  type BranchItem = { id: string; label: string; value: string };
  type BranchGroup = { value: string; label: string; items: BranchItem[] };

  // Convert branches to grouped combobox items format
  const branchGroups = React.useMemo((): BranchGroup[] => {
    const localItems: BranchItem[] = [];
    const remoteItems: BranchItem[] = [];

    for (const b of branches) {
      const item: BranchItem = {
        id: b.name,
        label: getBranchDisplayName(b.name) + (b.current ? ` (${t('Current')})` : ''),
        value: b.name,
      };
      if (b.name.startsWith('remotes/')) {
        remoteItems.push(item);
      } else {
        localItems.push(item);
      }
    }

    const groups: BranchGroup[] = [];
    if (localItems.length > 0) {
      groups.push({ value: 'local', label: t('Local branches'), items: localItems });
    }
    if (remoteItems.length > 0) {
      groups.push({ value: 'remote', label: t('Remote branches'), items: remoteItems });
    }
    return groups;
  }, [branches, t]);

  // Use current branch as default base
  const currentBranch = branches.find((b) => b.current);
  const defaultBranchItem = React.useMemo(() => {
    if (!currentBranch) return null;
    for (const group of branchGroups) {
      const found = group.items.find((item) => item.value === currentBranch.name);
      if (found) return found;
    }
    return null;
  }, [branchGroups, currentBranch]);

  // Initialize baseBranch state when dialog opens
  React.useEffect(() => {
    if (open && currentBranch && !baseBranch) {
      setBaseBranch(currentBranch.name);
    }
  }, [open, currentBranch, baseBranch]);

  const loadPullRequests = React.useCallback(async () => {
    setPrsLoading(true);
    try {
      const prs = await window.electronAPI.git.listPullRequests(workdir);
      setPullRequests(prs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PRs');
    } finally {
      setPrsLoading(false);
    }
  }, [workdir]);

  const checkGhStatus = React.useCallback(async () => {
    setGhStatusLoading(true);
    try {
      const status = await window.electronAPI.git.getGhStatus(workdir);
      setGhStatus(status);
      if (status.installed && status.authenticated) {
        loadPullRequests();
      }
    } catch {
      setGhStatus({ installed: false, authenticated: false, error: 'Failed to check gh status' });
    } finally {
      setGhStatusLoading(false);
    }
  }, [workdir, loadPullRequests]);

  // Check gh CLI status and load PRs when PR mode is selected
  React.useEffect(() => {
    if (open && mode === 'pr' && !ghStatus && !ghStatusLoading) {
      checkGhStatus();
    }
  }, [open, mode, ghStatus, ghStatusLoading, checkGhStatus]);

  // PR items for combobox
  type PrItem = { id: string; label: string; value: PullRequest };
  const prItems = React.useMemo((): PrItem[] => {
    return pullRequests.map((pr) => ({
      id: String(pr.number),
      label: `#${pr.number} ${pr.title}${pr.isDraft ? ` (${t('Draft')})` : ''}`,
      value: pr,
    }));
  }, [pullRequests, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'branch') {
      if (!newBranchName) {
        setError(t('Enter new branch name'));
        return;
      }

      if (!baseBranch) {
        setError(t('Select base branch'));
        return;
      }

      if (!home) {
        setError(t('Unable to determine your home directory'));
        return;
      }

      try {
        await onSubmit({
          path: getWorktreePath(newBranchName),
          branch: baseBranch,
          newBranch: newBranchName,
        });
        setOpen(false);
        resetForm();
      } catch (err) {
        handleSubmitError(err);
      }
    } else {
      // PR mode
      if (!selectedPr) {
        setError(t('Select a pull request'));
        return;
      }

      const branchName = newBranchName || selectedPr.headRefName;

      if (!home) {
        setError(t('Unable to determine your home directory'));
        return;
      }

      try {
        // First fetch PR to local branch (without checkout)
        await window.electronAPI.git.fetchPullRequest(workdir, selectedPr.number, branchName);

        // Then create worktree from that branch (branch already exists, no newBranch needed)
        await onSubmit({
          path: getWorktreePath(branchName),
          branch: branchName,
        });
        setOpen(false);
        resetForm();
      } catch (err) {
        handleSubmitError(err);
      }
    }
  };

  const handleSubmitError = (err: unknown) => {
    const message = err instanceof Error ? err.message : t('Failed to create');
    if (message.includes('already exists')) {
      setError(t('Worktree path already exists. Choose a different path or branch name.'));
    } else if (
      message.includes('is already used by worktree') ||
      message.includes('already checked out')
    ) {
      setError(t('Branch already exists. Choose a different name.'));
    } else {
      setError(message);
    }
  };

  const resetForm = () => {
    setBaseBranch(currentBranch?.name || '');
    setNewBranchName('');
    setSelectedPr(null);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset PR state when dialog closes
      setGhStatus(null);
      setPullRequests([]);
      setMode('branch');
      resetForm();
    }
  };

  const effectiveBranchName =
    mode === 'pr' ? newBranchName || selectedPr?.headRefName || '' : newBranchName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('New')}
            </Button>
          )
        }
      />
      <DialogPopup>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('New Worktree')}</DialogTitle>
            <DialogDescription>
              {t('Create a new branch and work in a separate directory to handle multiple tasks.')}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as CreateMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="branch" className="flex-1">
                  <GitBranch className="mr-2 h-4 w-4" />
                  {t('From branch')}
                </TabsTrigger>
                <TabsTrigger value="pr" className="flex-1">
                  <GitPullRequest className="mr-2 h-4 w-4" />
                  {t('From PR')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="branch" className="mt-4 space-y-4">
                {/* New Branch Name */}
                <Field>
                  <FieldLabel>{t('Branch name')}</FieldLabel>
                  <Input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="feature/my-feature"
                    autoFocus
                  />
                  <FieldDescription>
                    {t('This branch will be created and checked out in the new worktree.')}
                  </FieldDescription>
                </Field>

                {/* Base Branch Selection with Search */}
                <Field>
                  <FieldLabel>{t('Base branch')}</FieldLabel>
                  <Combobox
                    items={branchGroups}
                    defaultValue={defaultBranchItem}
                    onValueChange={(item: BranchItem | null) => setBaseBranch(item?.value || '')}
                  >
                    <ComboboxInput
                      placeholder={t('Search branches...')}
                      startAddon={<GitBranch className="h-4 w-4" />}
                      showTrigger
                    />
                    <ComboboxPopup>
                      <ComboboxEmpty>{t('No branches found')}</ComboboxEmpty>
                      <ComboboxList>
                        {(group: BranchGroup) => (
                          <React.Fragment key={group.value}>
                            <ComboboxGroup items={group.items}>
                              <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel>
                              <ComboboxCollection>
                                {(item: BranchItem) => (
                                  <ComboboxItem key={item.id} value={item}>
                                    {item.label}
                                  </ComboboxItem>
                                )}
                              </ComboboxCollection>
                            </ComboboxGroup>
                            {group.value === 'local' && branchGroups.length > 1 && (
                              <ComboboxSeparator />
                            )}
                          </React.Fragment>
                        )}
                      </ComboboxList>
                    </ComboboxPopup>
                  </Combobox>
                </Field>
              </TabsContent>

              <TabsContent value="pr" className="mt-4 space-y-4">
                {ghStatusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">{t('Checking gh CLI...')}</span>
                  </div>
                ) : ghStatus && !ghStatus.installed ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-destructive">
                          {t('GitHub CLI not installed')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('To create worktrees from pull requests, please install GitHub CLI:')}
                        </p>
                        <code className="block rounded bg-muted px-2 py-1 text-xs">
                          brew install gh
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.electronAPI.shell.openExternal('https://cli.github.com/')
                          }
                        >
                          {t('Learn more')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : ghStatus && !ghStatus.authenticated ? (
                  <div className="rounded-md border border-warning/50 bg-warning/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-warning">
                          {t('GitHub CLI not authenticated')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('Please authenticate with GitHub CLI:')}
                        </p>
                        <code className="block rounded bg-muted px-2 py-1 text-xs">
                          gh auth login
                        </code>
                        <Button type="button" variant="outline" size="sm" onClick={checkGhStatus}>
                          {t('Retry')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* PR Selection */}
                    <Field>
                      <FieldLabel>{t('Pull Request')}</FieldLabel>
                      {prsLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            {t('Loading pull requests...')}
                          </span>
                        </div>
                      ) : prItems.length === 0 ? (
                        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          {t('No open pull requests found')}
                        </div>
                      ) : (
                        <Combobox
                          items={prItems}
                          onValueChange={(item: PrItem | null) => {
                            setSelectedPr(item?.value || null);
                            // Auto-fill branch name from PR
                            if (item?.value && !newBranchName) {
                              setNewBranchName('');
                            }
                          }}
                        >
                          <ComboboxInput
                            placeholder={t('Search pull requests...')}
                            startAddon={<GitPullRequest className="h-4 w-4" />}
                            showTrigger
                          />
                          <ComboboxPopup>
                            <ComboboxEmpty>{t('No pull requests found')}</ComboboxEmpty>
                            <ComboboxList>
                              {(item: PrItem) => (
                                <ComboboxItem key={item.id} value={item}>
                                  <div className="flex flex-col">
                                    <span>{item.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.value.headRefName} · @{item.value.author}
                                    </span>
                                  </div>
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxPopup>
                        </Combobox>
                      )}
                    </Field>

                    {/* Optional: Override Branch Name */}
                    {selectedPr && (
                      <Field>
                        <FieldLabel>
                          {t('Branch name')} ({t('optional')})
                        </FieldLabel>
                        <Input
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          placeholder={selectedPr.headRefName}
                        />
                        <FieldDescription>
                          {t('Leave empty to use the PR branch name:')} {selectedPr.headRefName}
                        </FieldDescription>
                      </Field>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>

            {/* Path Preview */}
            {effectiveBranchName && home && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium">{t('Save location')}:</span>
                <code className="ml-1 break-all">{getWorktreePath(effectiveBranchName)}</code>
              </div>
            )}

            {error && <div className="text-sm text-destructive">{error}</div>}
          </DialogPanel>

          <DialogFooter variant="bare">
            <DialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
            <Button
              type="submit"
              disabled={
                isLoading ||
                (mode === 'pr' && (!ghStatus?.authenticated || !selectedPr)) ||
                (mode === 'branch' && !newBranchName)
              }
            >
              {isLoading ? t('Creating...') : t('Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
