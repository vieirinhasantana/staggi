/**
 * Svelte 5 Desktop Keyboard Shortcut Hook
 * Handles key combinations (e.g., 'Escape', 'Enter', 'k' with ctrl/meta) gracefully.
 */
export interface ShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  target?: Window | HTMLElement;
}

export function useKeyboardShortcut(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  $effect(() => {
    if (typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      if (options.ctrl && !e.ctrlKey) return;
      if (options.meta && !e.metaKey) return;
      if (options.shift && !e.shiftKey) return;
      if (options.alt && !e.altKey) return;

      if (options.preventDefault) {
        e.preventDefault();
      }

      callback(e);
    }

    const element = options.target || window;
    element.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      element.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  });
}
