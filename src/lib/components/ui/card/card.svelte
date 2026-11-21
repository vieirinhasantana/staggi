<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type Props = HTMLAttributes<HTMLDivElement> & {
    class?: string;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div
  class={cn(
    "rounded-2xl border border-white/[0.08] bg-[#1c1a28]/80 text-zinc-100 shadow-sm backdrop-blur-xl",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
