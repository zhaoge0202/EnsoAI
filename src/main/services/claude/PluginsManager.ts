import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AvailablePlugin, InstalledPlugin, Plugin, PluginMarketplace } from '@shared/types';
import * as pty from 'node-pty';
import { getEnvForCommand, getShellForCommand } from '../../utils/shell';

/**
 * Strip ANSI escape codes from terminal output
 */
function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence is intentional
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Execute command in PTY to load user's environment (PATH, nvm, mise, volta, etc.)
 * Uses the same mechanism as terminal sessions to ensure consistent behavior.
 */
async function execInPty(command: string, timeout = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const { shell, args } = getShellForCommand();
    const shellName = shell.toLowerCase();

    let shellArgs: string[];

    if (shellName.includes('wsl')) {
      const escapedCommand = command.replace(/"/g, '\\"');
      shellArgs = ['-e', 'sh', '-lc', `exec "$SHELL" -ilc "${escapedCommand}"`];
    } else if (shellName.includes('powershell') || shellName.includes('pwsh')) {
      shellArgs = [...args, `& { ${command}; exit $LASTEXITCODE }`];
    } else if (shellName.includes('cmd')) {
      shellArgs = [...args, `${command} & exit %ERRORLEVEL%`];
    } else {
      shellArgs = [...args, `${command}; exit $?`];
    }

    let output = '';
    let hasExited = false;
    let ptyProcess: pty.IPty | null = null;

    const timeoutId = setTimeout(() => {
      if (!hasExited && ptyProcess) {
        hasExited = true;
        ptyProcess.kill();
        reject(new Error('Command timeout'));
      }
    }, timeout);

    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || '/',
        env: {
          ...getEnvForCommand(),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      });

      ptyProcess.onData((data) => {
        output += data;
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (hasExited) return;
        hasExited = true;
        clearTimeout(timeoutId);

        if (exitCode === 0) {
          resolve(stripAnsi(output).trim());
        } else {
          reject(new Error(`Command exited with code ${exitCode}`));
        }
      });
    } catch (error) {
      hasExited = true;
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

function getPluginsDir(): string {
  return path.join(os.homedir(), '.claude', 'plugins');
}

function getSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function getInstalledPluginsPath(): string {
  return path.join(getPluginsDir(), 'installed_plugins.json');
}

function getKnownMarketplacesPath(): string {
  return path.join(getPluginsDir(), 'known_marketplaces.json');
}

interface InstalledPluginsJson {
  version: number;
  plugins: Record<string, InstalledPlugin[]>;
}

interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

/**
 * 读取已安装的插件
 */
function readInstalledPlugins(): InstalledPluginsJson {
  try {
    const filePath = getInstalledPluginsPath();
    if (!fs.existsSync(filePath)) {
      return { version: 2, plugins: {} };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as InstalledPluginsJson;
  } catch (error) {
    console.error('[PluginsManager] Failed to read installed_plugins.json:', error);
    return { version: 2, plugins: {} };
  }
}

/**
 * 读取 Claude settings
 */
function readSettings(): ClaudeSettings {
  try {
    const filePath = getSettingsPath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch (error) {
    console.error('[PluginsManager] Failed to read settings.json:', error);
    return {};
  }
}

/**
 * 写入 Claude settings
 */
function writeSettings(data: ClaudeSettings): boolean {
  try {
    const filePath = getSettingsPath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to write settings.json:', error);
    return false;
  }
}

/**
 * 获取所有插件列表
 */
export function getPlugins(): Plugin[] {
  const installed = readInstalledPlugins();
  const settings = readSettings();
  const enabledPlugins = settings.enabledPlugins ?? {};

  const plugins: Plugin[] = [];

  for (const [pluginId, installations] of Object.entries(installed.plugins)) {
    // 取第一个安装（通常是 user scope）
    const installation = installations[0];
    if (!installation) continue;

    // 解析插件 ID：name@marketplace
    const [name, marketplace] = pluginId.split('@');

    plugins.push({
      id: pluginId,
      name: name ?? pluginId,
      marketplace: marketplace ?? 'unknown',
      version: installation.version,
      installPath: installation.installPath,
      enabled: enabledPlugins[pluginId] ?? false,
      installedAt: installation.installedAt,
      lastUpdated: installation.lastUpdated,
    });
  }

  return plugins;
}

/**
 * 设置插件启用状态
 */
export function setPluginEnabled(pluginId: string, enabled: boolean): boolean {
  const settings = readSettings();

  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }

  settings.enabledPlugins[pluginId] = enabled;

  const success = writeSettings(settings);

  if (success) {
    console.log(`[PluginsManager] Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  return success;
}

/**
 * 获取插件启用状态
 */
export function getEnabledPlugins(): Record<string, boolean> {
  const settings = readSettings();
  return settings.enabledPlugins ?? {};
}

interface KnownMarketplacesJson {
  [name: string]: {
    source: {
      source: string;
      repo: string;
    };
    installLocation: string;
    lastUpdated: string;
  };
}

/**
 * 读取已知的 marketplaces
 */
function readKnownMarketplaces(): KnownMarketplacesJson {
  try {
    const filePath = getKnownMarketplacesPath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as KnownMarketplacesJson;
  } catch (error) {
    console.error('[PluginsManager] Failed to read known_marketplaces.json:', error);
    return {};
  }
}

/**
 * 获取所有 marketplaces
 */
export function getMarketplaces(): PluginMarketplace[] {
  const known = readKnownMarketplaces();

  return Object.entries(known).map(([name, data]) => ({
    name,
    repo: data.source.repo,
    installLocation: data.installLocation,
    lastUpdated: data.lastUpdated,
  }));
}

/**
 * 添加 marketplace（调用 Claude CLI）
 */
export async function addMarketplace(source: string): Promise<boolean> {
  try {
    const cmd = `claude plugin marketplace add "${source}"`;
    console.log(`[PluginsManager] Running: ${cmd}`);
    const stdout = await execInPty(cmd);

    if (stdout) console.log(`[PluginsManager] ${stdout}`);

    console.log(`[PluginsManager] Marketplace added: ${source}`);
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to add marketplace:', error);
    return false;
  }
}

/**
 * 删除 marketplace（调用 Claude CLI）
 */
export async function removeMarketplace(name: string): Promise<boolean> {
  try {
    const cmd = `claude plugin marketplace remove "${name}"`;
    console.log(`[PluginsManager] Running: ${cmd}`);
    const stdout = await execInPty(cmd, 30000);

    if (stdout) console.log(`[PluginsManager] ${stdout}`);

    console.log(`[PluginsManager] Marketplace removed: ${name}`);
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to remove marketplace:', error);
    return false;
  }
}

/**
 * 刷新 marketplaces（调用 Claude CLI）
 */
export async function refreshMarketplaces(name?: string): Promise<boolean> {
  try {
    const cmd = name
      ? `claude plugin marketplace update "${name}"`
      : 'claude plugin marketplace update';

    console.log(`[PluginsManager] Running: ${cmd}`);
    const stdout = await execInPty(cmd);

    if (stdout) console.log(`[PluginsManager] ${stdout}`);

    console.log(`[PluginsManager] Marketplaces refreshed`);
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to refresh marketplaces:', error);
    return false;
  }
}

interface PluginJson {
  name: string;
  description?: string;
  version?: string;
  author?: {
    name?: string;
    email?: string;
  };
}

interface MarketplaceJson {
  name: string;
  description?: string;
  plugins?: Array<{
    name: string;
    description?: string;
    author?: {
      name?: string;
      email?: string;
    };
  }>;
}

/**
 * 扫描 marketplace 中可用的插件
 */
export function getAvailablePlugins(marketplaceName?: string): AvailablePlugin[] {
  const marketplaces = readKnownMarketplaces();
  const installed = readInstalledPlugins();
  const installedIds = new Set(Object.keys(installed.plugins));

  const plugins: AvailablePlugin[] = [];

  const marketplaceEntries = marketplaceName
    ? Object.entries(marketplaces).filter(([name]) => name === marketplaceName)
    : Object.entries(marketplaces);

  for (const [mpName, mpData] of marketplaceEntries) {
    // 方式 1: 检查 marketplace.json（如 claude-plugins-official）
    const marketplaceJsonPath = path.join(
      mpData.installLocation,
      '.claude-plugin',
      'marketplace.json'
    );

    if (fs.existsSync(marketplaceJsonPath)) {
      try {
        const content = fs.readFileSync(marketplaceJsonPath, 'utf-8');
        const mpJson = JSON.parse(content) as MarketplaceJson;

        if (mpJson.plugins) {
          for (const plugin of mpJson.plugins) {
            const pluginId = `${plugin.name}@${mpName}`;
            plugins.push({
              name: plugin.name,
              description: plugin.description,
              author: plugin.author,
              marketplace: mpName,
              installed: installedIds.has(pluginId),
            });
          }
        }
        continue;
      } catch (err) {
        console.warn(`[PluginsManager] Failed to read marketplace.json for ${mpName}:`, err);
      }
    }

    // 方式 2: 扫描根目录的 plugin.json（整个 repo 是一个插件）
    const rootPluginJsonPath = path.join(mpData.installLocation, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(rootPluginJsonPath)) {
      try {
        const content = fs.readFileSync(rootPluginJsonPath, 'utf-8');
        const pluginJson = JSON.parse(content) as PluginJson;
        const pluginId = `${pluginJson.name}@${mpName}`;

        plugins.push({
          name: pluginJson.name,
          description: pluginJson.description,
          author: pluginJson.author,
          marketplace: mpName,
          installed: installedIds.has(pluginId),
        });
        continue;
      } catch (err) {
        console.warn(`[PluginsManager] Failed to read root plugin.json for ${mpName}:`, err);
      }
    }

    // 方式 3: 扫描子目录中的 plugin.json（如 nowledge-community）
    try {
      const dirs = fs.readdirSync(mpData.installLocation, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory() || dir.name.startsWith('.')) continue;

        // 检查 dir/plugin.json
        const pluginJsonPath = path.join(mpData.installLocation, dir.name, 'plugin.json');
        if (fs.existsSync(pluginJsonPath)) {
          try {
            const content = fs.readFileSync(pluginJsonPath, 'utf-8');
            const pluginJson = JSON.parse(content) as PluginJson;
            const pluginId = `${pluginJson.name}@${mpName}`;

            plugins.push({
              name: pluginJson.name,
              description: pluginJson.description,
              author: pluginJson.author,
              marketplace: mpName,
              installed: installedIds.has(pluginId),
            });
          } catch (err) {
            console.warn(`[PluginsManager] Failed to read plugin.json for ${dir.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[PluginsManager] Failed to scan directory for ${mpName}:`, err);
    }
  }

  return plugins;
}

/**
 * 安装插件（调用 Claude CLI）
 */
export async function installPlugin(pluginName: string, marketplace?: string): Promise<boolean> {
  try {
    const pluginSpec = marketplace ? `${pluginName}@${marketplace}` : pluginName;
    const cmd = `claude plugin install "${pluginSpec}"`;

    console.log(`[PluginsManager] Running: ${cmd}`);
    const stdout = await execInPty(cmd, 120000);

    if (stdout) console.log(`[PluginsManager] ${stdout}`);

    console.log(`[PluginsManager] Plugin installed: ${pluginSpec}`);
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to install plugin:', error);
    return false;
  }
}

/**
 * 卸载插件（调用 Claude CLI）
 */
export async function uninstallPlugin(pluginId: string): Promise<boolean> {
  try {
    const cmd = `claude plugin uninstall "${pluginId}"`;

    console.log(`[PluginsManager] Running: ${cmd}`);
    const stdout = await execInPty(cmd, 30000);

    if (stdout) console.log(`[PluginsManager] ${stdout}`);

    console.log(`[PluginsManager] Plugin uninstalled: ${pluginId}`);
    return true;
  } catch (error) {
    console.error('[PluginsManager] Failed to uninstall plugin:', error);
    return false;
  }
}
