<script lang="ts">
  import "../app.css";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { onMount } from "svelte";
  import { privacyStore } from "$lib/services/privacyState.svelte";

  let { children } = $props();

  onMount(() => {
    privacyStore.init();
    if (typeof navigator !== "undefined") {
      const isWindows = /Windows|Win32|Win64/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.indexOf("Win") !== -1);
      if (isWindows) {
        document.documentElement.classList.add("platform-windows");
      }
    }
  });
</script>

<ToastContainer />
{@render children()}
