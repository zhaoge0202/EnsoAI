import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { autoUpdaterService } from '../services/updater/AutoUpdater';

export function registerUpdaterHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async () => {
    await autoUpdaterService.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_QUIT_AND_INSTALL, () => {
    autoUpdaterService.quitAndInstall();
  });
}
