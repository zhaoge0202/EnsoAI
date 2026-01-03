import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function getClaudeMdPath(): string {
  return path.join(os.homedir(), '.claude', 'CLAUDE.md');
}

/**
 * 读取 ~/.claude/CLAUDE.md 内容
 */
export function readClaudeMd(): string | null {
  try {
    const mdPath = getClaudeMdPath();
    if (!fs.existsSync(mdPath)) {
      return null;
    }
    return fs.readFileSync(mdPath, 'utf-8');
  } catch (error) {
    console.error('[PromptsManager] Failed to read CLAUDE.md:', error);
    return null;
  }
}

/**
 * 写入内容到 ~/.claude/CLAUDE.md
 */
export function writeClaudeMd(content: string): boolean {
  try {
    const mdPath = getClaudeMdPath();
    const dir = path.dirname(mdPath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }

    fs.writeFileSync(mdPath, content, { mode: 0o644 });
    console.log('[PromptsManager] Wrote CLAUDE.md');
    return true;
  } catch (error) {
    console.error('[PromptsManager] Failed to write CLAUDE.md:', error);
    return false;
  }
}

/**
 * 备份当前 CLAUDE.md
 * 返回备份文件路径
 */
export function backupClaudeMd(): string | null {
  try {
    const mdPath = getClaudeMdPath();
    if (!fs.existsSync(mdPath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(os.homedir(), '.claude', 'backups', `CLAUDE.md.${timestamp}.bak`);
    const backupDir = path.dirname(backupPath);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o755 });
    }

    fs.copyFileSync(mdPath, backupPath);
    console.log(`[PromptsManager] Backed up CLAUDE.md to ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('[PromptsManager] Failed to backup CLAUDE.md:', error);
    return null;
  }
}
