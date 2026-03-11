import type { GitBlameLineInfo } from '@shared/types';
import type * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';

type Monaco = typeof monaco;

// Constants
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const MS_PER_MONTH = 2592000000; // 30 days
const MS_PER_YEAR = 31536000000; // 365 days
const CURSOR_DEBOUNCE_MS = 150;
const CONTENT_CHANGE_DEBOUNCE_MS = 1000; // Debounce for re-fetching blame after edit

function formatRelativeTime(
  isoDate: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < MS_PER_MINUTE) return t('Just now');
  if (diffMs < MS_PER_HOUR)
    return t('{{count}} minutes ago', { count: Math.floor(diffMs / MS_PER_MINUTE) });
  if (diffMs < MS_PER_DAY)
    return t('{{count}} hours ago', { count: Math.floor(diffMs / MS_PER_HOUR) });
  if (diffMs < MS_PER_MONTH)
    return t('{{count}} days ago', { count: Math.floor(diffMs / MS_PER_DAY) });
  if (diffMs < MS_PER_YEAR)
    return t('{{count}} months ago', { count: Math.floor(diffMs / MS_PER_MONTH) });
  return t('{{count}} years ago', { count: Math.floor(diffMs / MS_PER_YEAR) });
}

function isUncommitted(hash: string): boolean {
  return /^0+$/.test(hash);
}

function escapeCssString(str: string): string {
  return str.replace(/([\\'"()])/g, '\\$1').replace(/\n/g, '');
}

interface UseEditorBlameOptions {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: Monaco | null;
  filePath: string | null;
  rootPath: string | undefined;
  enabled: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useEditorBlame({
  editor,
  monacoInstance,
  filePath,
  rootPath,
  enabled,
  t,
}: UseEditorBlameOptions): void {
  // Consolidated state refs
  const stateRef = useRef<{
    cache: Map<string, Map<number, GitBlameLineInfo>>;
    decorations: string[];
    currentLine: number | null;
    loadingFiles: Set<string>;
    debounceTimer: ReturnType<typeof setTimeout> | null;
    contentChangeTimer: ReturnType<typeof setTimeout> | null;
  }>({
    cache: new Map(),
    decorations: [],
    currentLine: null,
    loadingFiles: new Set(),
    debounceTimer: null,
    contentChangeTimer: null,
  });

  useEffect(() => {
    if (!editor || !monacoInstance || !filePath || !rootPath || !enabled) {
      if (editor && stateRef.current.decorations.length > 0) {
        stateRef.current.decorations = editor.deltaDecorations(stateRef.current.decorations, []);
      }
      stateRef.current.currentLine = null;
      return;
    }

    // Per-instance style element (not global)
    const styleId = `git-blame-inline-styles-${filePath}`;
    let styleElement: HTMLStyleElement | null = null;

    // Create style element with CSS variable approach
    if (!document.getElementById(styleId)) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        .git-blame-decoration::after {
          content: var(--git-blame-content, '');
          color: var(--muted-foreground);
          opacity: 0.5;
          font-style: italic;
          padding-left: 2em;
          pointer-events: none;
          white-space: pre;
        }
      `;
      document.head.appendChild(styleElement);
    }

    let disposed = false;

    const clearDeco = (): void => {
      if (stateRef.current.decorations.length > 0) {
        stateRef.current.decorations = editor.deltaDecorations(stateRef.current.decorations, []);
      }
      stateRef.current.currentLine = null;
      // Reset CSS variable
      document.documentElement.style.setProperty('--git-blame-content', "''");
    };

    const showBlameForLine = (lineNumber: number): void => {
      if (disposed) return;

      const lineData = stateRef.current.cache.get(filePath);
      if (!lineData) {
        clearDeco();
        return;
      }

      const info = lineData.get(lineNumber);
      if (!info || isUncommitted(info.hash)) {
        clearDeco();
        return;
      }

      if (stateRef.current.currentLine === lineNumber) return;
      stateRef.current.currentLine = lineNumber;

      const timeAgo = formatRelativeTime(info.date, t);
      const shortHash = info.hash.slice(0, 7);
      const blameText = `  ${info.author}, ${timeAgo} · ${info.message} (${shortHash})`;

      // Update CSS variable (much faster than replacing entire style tag)
      const escaped = escapeCssString(blameText);
      document.documentElement.style.setProperty('--git-blame-content', `'${escaped}'`);

      const model = editor.getModel();
      if (!model) return;

      const lineLength = model.getLineLength(lineNumber);
      const endColumn = lineLength + 1;

      const decoration: monaco.editor.IModelDeltaDecoration = {
        range: new monacoInstance.Range(lineNumber, endColumn, lineNumber, endColumn),
        options: {
          afterContentClassName: 'git-blame-decoration',
        },
      };

      stateRef.current.decorations = editor.deltaDecorations(stateRef.current.decorations, [
        decoration,
      ]);
    };

    const fetchAndShow = async (): Promise<void> => {
      if (stateRef.current.cache.has(filePath)) {
        const pos = editor.getPosition();
        if (pos) showBlameForLine(pos.lineNumber);
        return;
      }

      if (stateRef.current.loadingFiles.has(filePath)) return;

      if (!filePath.startsWith(rootPath)) return;

      const relativePath = filePath.slice(rootPath.length).replace(/^\//, '');
      if (!relativePath) return;

      stateRef.current.loadingFiles.add(filePath);
      try {
        const blameData: GitBlameLineInfo[] = await window.electronAPI.git.blame(
          rootPath,
          relativePath
        );

        const lineMap = new Map<number, GitBlameLineInfo>();
        for (const entry of blameData) {
          lineMap.set(entry.lineNumber, entry);
        }
        stateRef.current.cache.set(filePath, lineMap);

        if (!disposed) {
          const pos = editor.getPosition();
          if (pos) showBlameForLine(pos.lineNumber);
        }
      } catch (err) {
        console.warn('[git-blame] Failed to fetch blame data:', err);
      } finally {
        stateRef.current.loadingFiles.delete(filePath);
      }
    };

    fetchAndShow();

    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      if (stateRef.current.debounceTimer) {
        clearTimeout(stateRef.current.debounceTimer);
      }
      stateRef.current.debounceTimer = setTimeout(() => {
        // Use requestAnimationFrame for smoother cursor movement
        requestAnimationFrame(() => {
          showBlameForLine(e.position.lineNumber);
        });
      }, CURSOR_DEBOUNCE_MS);
    });

    const blurDisposable = editor.onDidBlurEditorText(() => {
      clearDeco();
    });

    const modelDisposable = editor.onDidChangeModelContent(() => {
      // Clear current decoration since line info may be stale
      clearDeco();

      // Debounce re-fetch to avoid excessive git calls during editing
      if (stateRef.current.contentChangeTimer) {
        clearTimeout(stateRef.current.contentChangeTimer);
      }
      stateRef.current.contentChangeTimer = setTimeout(() => {
        // Invalidate cache and re-fetch to get updated blame info
        stateRef.current.cache.delete(filePath);
        fetchAndShow();
      }, CONTENT_CHANGE_DEBOUNCE_MS);
    });

    return () => {
      disposed = true;
      cursorDisposable.dispose();
      blurDisposable.dispose();
      modelDisposable.dispose();
      if (stateRef.current.debounceTimer) {
        clearTimeout(stateRef.current.debounceTimer);
        stateRef.current.debounceTimer = null;
      }
      if (stateRef.current.contentChangeTimer) {
        clearTimeout(stateRef.current.contentChangeTimer);
        stateRef.current.contentChangeTimer = null;
      }
      clearDeco();
      // Cleanup style element
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, [editor, monacoInstance, filePath, rootPath, enabled, t]);
}
