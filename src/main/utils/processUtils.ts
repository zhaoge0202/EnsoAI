/**
 * Process management utilities for consistent process tree handling across the app.
 */

import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

/**
 * Generic interface for process-like objects with pid and kill method
 */
interface ProcessLike {
  pid?: number;
  kill(signal?: NodeJS.Signals | string): void;
}

/**
 * Kill a process and all its children (process tree).
 * On Windows: uses taskkill /T to kill the process tree synchronously.
 * On Unix: kills the process group using negative PID, or falls back to regular kill.
 *
 * @param target - PID number, ChildProcess, or any object with pid and kill method (e.g., IPty)
 * @param signal - Signal to send on Unix (default: SIGKILL)
 */
export function killProcessTree(
  target: number | ChildProcess | ProcessLike,
  signal: NodeJS.Signals = 'SIGKILL'
): void {
  // Extract PID from target
  let pid: number | undefined;
  if (typeof target === 'number') {
    pid = target;
  } else if ('pid' in target) {
    pid = target.pid;
  }

  if (!pid) {
    // No PID available, try to kill directly if possible
    if (typeof target !== 'number' && 'kill' in target) {
      try {
        target.kill(signal);
      } catch {
        // Ignore
      }
    }
    return;
  }

  try {
    if (isWindows) {
      // Windows: use taskkill synchronously to kill the entire process tree
      spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      // Unix: try to kill the process group first
      try {
        process.kill(-pid, signal);
      } catch {
        // If process group kill fails, fall back to regular kill
        if (typeof target !== 'number' && 'kill' in target) {
          target.kill(signal);
        } else {
          process.kill(pid, signal);
        }
      }
    }
  } catch {
    // Process may have already exited, ignore errors
  }
}
