<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type Props = HTMLAttributes<HTMLHeadingElement> & {
    class?: string;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<h3
  class={cn("text-sm font-semibold  leading-none tracking-tight text-zinc-100", className)}
  {...restProps}
>
  {@render children?.()}
</h3>
