<script lang="ts">
  import "../app.css";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(() => {
    // 1. Detect Windows platform for scrollbar/drag adjustments
    if (typeof navigator !== "undefined") {
      const isWindows = /Windows|Win32|Win64/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.indexOf("Win") !== -1);
      if (isWindows) {
        document.documentElement.classList.add("platform-windows");
      }
    }

    // 2. Disable DevTools shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C) and inspect context menu in production
    if (import.meta.env.PROD) {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Block F12
        if (e.key === "F12") {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Cmd on macOS)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Block Ctrl+U / Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && ["U", "u"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        // Prevent default context menu (Inspect Element) in production
        e.preventDefault();
      };

      window.addEventListener("keydown", handleKeyDown, { capture: true });
      window.addEventListener("contextmenu", handleContextMenu, { capture: true });

      return () => {
        window.removeEventListener("keydown", handleKeyDown, { capture: true });
        window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      };
    }
  });
</script>

<ToastContainer />
{@render children()}
