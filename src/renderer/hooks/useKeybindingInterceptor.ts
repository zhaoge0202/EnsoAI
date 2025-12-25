import { useEffect } from 'react';
import { type TerminalKeybinding, useSettingsStore } from '@/stores/settings';

type KeybindingType = 'closeTab' | 'newTab' | 'nextTab' | 'prevTab' | 'clear';

function matchesKeybinding(e: KeyboardEvent, binding: TerminalKeybinding): boolean {
  const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
  const ctrlMatch = binding.ctrl ? e.ctrlKey : !e.ctrlKey;
  const altMatch = binding.alt ? e.altKey : !e.altKey;
  const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;
  const metaMatch = binding.meta ? e.metaKey : !e.metaKey;
  return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
}

/**
 * Intercept terminal keybindings when a condition is met.
 * Useful for dialogs/modals that need to capture close shortcuts.
 *
 * @param isActive - Whether to intercept keybindings
 * @param keybinding - Which keybinding to intercept
 * @param onMatch - Callback when the keybinding is pressed
 */
export function useKeybindingInterceptor(
  isActive: boolean,
  keybinding: KeybindingType,
  onMatch: () => void
) {
  const terminalKeybindings = useSettingsStore((s) => s.terminalKeybindings);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if a keybinding input is being recorded
      const activeElement = document.activeElement;
      if (activeElement?.hasAttribute('data-keybinding-recording')) {
        return;
      }

      const binding = terminalKeybindings[keybinding];
      if (matchesKeybinding(e, binding)) {
        e.preventDefault();
        e.stopPropagation();
        onMatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, keybinding, terminalKeybindings, onMatch]);
}
