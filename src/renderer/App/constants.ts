// Animation config
export const panelTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

// Tab types
export type TabId = 'chat' | 'file' | 'terminal' | 'source-control';

// Tab metadata configuration
export interface TabConfig {
  id: TabId;
  icon: React.ElementType;
  labelKey: string;
}

// Default tab order
export const DEFAULT_TAB_ORDER: TabId[] = ['chat', 'file', 'terminal', 'source-control'];

// ========== Repository Group ==========

/** 全部分组 ID（特殊值） */
export const ALL_GROUP_ID = '__all__';

/** 分组 Emoji 预设 */
export const GROUP_EMOJI_PRESETS = ['🏠', '💼', '🧪', '📦', '🎮', '📚', '🔧', '🌟', '🎯', '🚀'];

/** 生成分组 ID */
export const generateGroupId = (): string =>
  `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 仓库分组 */
export interface RepositoryGroup {
  /** 唯一标识 */
  id: string;
  /** 分组名称 */
  name: string;
  /** Emoji 图标 */
  emoji: string;
  /** 显示顺序 */
  order: number;
}

// Repository type
export interface Repository {
  name: string;
  path: string;
  /** 所属分组 ID，undefined = 仅在「全部」中显示 */
  groupId?: string;
}

// Panel size constraints
export const REPOSITORY_MIN = 200;
export const REPOSITORY_MAX = 400;
export const REPOSITORY_DEFAULT = 240;
export const WORKTREE_MIN = 200;
export const WORKTREE_MAX = 400;
export const WORKTREE_DEFAULT = 280;

// Tree layout constraints
export const TREE_SIDEBAR_MIN = 200;
export const TREE_SIDEBAR_DEFAULT = 280;
