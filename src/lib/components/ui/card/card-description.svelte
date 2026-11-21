<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type Props = HTMLAttributes<HTMLParagraphElement> & {
    class?: string;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<p class={cn("text-xs text-zinc-400 font-sans leading-relaxed", className)} {...restProps}>
  {@render children?.()}
</p>
