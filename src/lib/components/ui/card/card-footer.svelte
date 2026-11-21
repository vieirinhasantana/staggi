<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type Props = HTMLAttributes<HTMLDivElement> & {
    class?: string;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div class={cn("flex items-center p-4 pt-0 border-t border-white/[0.06]", className)} {...restProps}>
  {@render children?.()}
</div>
