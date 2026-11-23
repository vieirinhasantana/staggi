<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type Props = HTMLInputAttributes & {
    class?: string;
    value?: string | number;
  };

  let { class: className, value = $bindable(), ...restProps }: Props = $props();
</script>

<input
  bind:value
  class={cn(
    "flex h-9 w-full rounded-xl border border-white/[0.12] bg-[#232323] px-3 py-1 text-xs text-zinc-100  shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:border-amber-400/70 focus-visible:ring-1 focus-visible:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50",
    className
  )}
  {...restProps}
/>
