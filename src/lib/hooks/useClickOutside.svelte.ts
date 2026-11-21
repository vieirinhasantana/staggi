/**
 * Svelte 5 Click Outside Action & Hook
 * Triggers callback when a click occurs outside the specified element ref.
 */
export function clickOutside(
  node: HTMLElement,
  callback: (e: MouseEvent | TouchEvent) => void
) {
  function handleClick(event: MouseEvent | TouchEvent) {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      callback(event);
    }
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("touchstart", handleClick, true);

  return {
    destroy() {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
    },
  };
}
