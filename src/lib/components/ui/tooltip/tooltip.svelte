<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  interface Props {
    content: string;
    children?: Snippet;
    class?: string;
    position?: "top" | "bottom" | "left" | "right";
  }

  let {
    content,
    children,
    class: className,
    position = "top",
  }: Props = $props();

  let isVisible = $state(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative inline-flex"
  onmouseenter={() => (isVisible = true)}
  onmouseleave={() => (isVisible = false)}
  onfocusin={() => (isVisible = true)}
  onfocusout={() => (isVisible = false)}
>
  {@render children?.()}
  {#if isVisible && content}
    <div
      role="tooltip"
      class={cn(
        "absolute z-50 pointer-events-none rounded-lg bg-[#252236] border border-white/[0.12] px-2.5 py-1 text-[11px] font-mono text-zinc-200 shadow-xl whitespace-nowrap animate-fade-in",
        positionClasses[position],
        className
      )}
    >
      {content}
    </div>
  {/if}
</div>
