/**
 * Svelte 5 Rune-based Debounce Hook
 * Produces a debounced version of any reactive getter value.
 */
export function useDebounce<T>(getter: () => T, delayMs: number = 300): () => T {
  let debouncedValue = $state<T>(getter());

  $effect(() => {
    const current = getter();
    const timer = setTimeout(() => {
      debouncedValue = current;
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  });

  return () => debouncedValue;
}
