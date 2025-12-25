import { registerAgentHandlers } from './agent';
import { registerAppHandlers } from './app';
import { registerCliHandlers } from './cli';
import { registerDialogHandlers } from './dialog';
import { registerFileHandlers } from './files';
import { registerGitHandlers } from './git';
import { registerNotificationHandlers } from './notification';
import { registerSettingsHandlers } from './settings';
import { registerShellHandlers } from './shell';
import { registerTerminalHandlers } from './terminal';
import { registerUpdaterHandlers } from './updater';
import { registerWorktreeHandlers } from './worktree';

export function registerIpcHandlers(): void {
  registerGitHandlers();
  registerWorktreeHandlers();
  registerFileHandlers();
  registerTerminalHandlers();
  registerAgentHandlers();
  registerDialogHandlers();
  registerAppHandlers();
  registerCliHandlers();
  registerShellHandlers();
  registerSettingsHandlers();
  registerNotificationHandlers();
  registerUpdaterHandlers();
}
