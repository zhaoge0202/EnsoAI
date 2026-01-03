/**
 * Claude Plugins 类型定义
 */

export interface InstalledPlugin {
  scope: 'user' | 'project';
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  isLocal: boolean;
  gitCommitSha?: string;
}

export interface Plugin {
  /** 插件 ID，格式：name@marketplace */
  id: string;
  /** 插件名称 */
  name: string;
  /** 所属市场 */
  marketplace: string;
  /** 版本 */
  version: string;
  /** 安装路径 */
  installPath: string;
  /** 是否启用 */
  enabled: boolean;
  /** 安装时间 */
  installedAt: string;
  /** 最后更新时间 */
  lastUpdated: string;
}

export interface PluginMarketplace {
  /** 市场名称 */
  name: string;
  /** GitHub 仓库 */
  repo: string;
  /** 安装位置 */
  installLocation: string;
  /** 最后更新时间 */
  lastUpdated: string;
}

export interface AvailablePlugin {
  /** 插件名称 */
  name: string;
  /** 插件描述 */
  description?: string;
  /** 作者 */
  author?: {
    name?: string;
    email?: string;
  };
  /** 所属 marketplace */
  marketplace: string;
  /** 是否已安装 */
  installed: boolean;
}
