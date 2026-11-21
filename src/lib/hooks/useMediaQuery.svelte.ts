/**
 * Svelte 5 Reactive Media Query Hook
 */
export function useMediaQuery(query: string): () => boolean {
  let matches = $state(false);

  $effect(() => {
    if (typeof window === "undefined") return;

    const mediaList = window.matchMedia(query);
    matches = mediaList.matches;

    function listener(e: MediaQueryListEvent) {
      matches = e.matches;
    }

    mediaList.addEventListener("change", listener);
    return () => {
      mediaList.removeEventListener("change", listener);
    };
  });

  return () => matches;
}
