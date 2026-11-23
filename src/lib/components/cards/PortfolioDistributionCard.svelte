<script lang="ts">
  import type { ParsedPortfolioDistribution } from "$lib/types";
  import { renderMarkdown } from "$lib/services/formatMessage";
  import { 
    PieChart, 
    Layers, 
    Table, 
    ShieldCheck, 
    Sparkles, 
    TrendingUp, 
    UserCheck, 
    Wallet
  } from "@lucide/svelte";

  interface Props {
    data: ParsedPortfolioDistribution;
    rawText: string;
    source?: string;
  }

  let { data, rawText, source }: Props = $props();

  let activeTab = $state<"overview" | "chartOnly" | "tableOnly">("overview");
  let hoveredIndex = $state<number | null>(null);

  const totalSum = $derived(
    data.items.reduce((acc, it) => acc + it.percentage, 0) || 100
  );

  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.9911

  // Calculate cumulative dash offsets for each slice
  const slices = $derived.by(() => {
    let currentOffset = 0;
    return data.items.map((item, idx) => {
      const sliceLength = (item.percentage / totalSum) * circumference;
      const offset = -currentOffset;
      currentOffset += sliceLength;
      return {
        ...item,
        index: idx,
        dashLength: Math.max(0, sliceLength - 2), // 2px gap between slices
        offset
      };
    });
  });

  const activeItem = $derived(
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.items.length
      ? data.items[hoveredIndex]
      : null
  );
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#212121]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-4 select-text">
  <!-- Card Header -->
  <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
    <div class="flex items-center gap-3">
      <div class="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-bold text-xs shadow-inner">
        <PieChart class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold text-zinc-100">{data.title}</span>
          {#if data.clientName}
            <span class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
              <UserCheck class="w-3 h-3" />
              {data.clientName}
            </span>
          {/if}
          <span class="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 text-[11px] font-medium border border-white/[0.08]">
            {data.items.length} Alocações
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
          <span>Distribuição percentual e classes de ativos</span>
          {#if data.totalValue}
            <span>•</span>
            <span class="text-zinc-200 font-medium flex items-center gap-1">
              <Wallet class="w-3 h-3 text-emerald-400" />
              Total: <strong class="text-emerald-300">{data.totalValue}</strong>
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- View Mode Switcher -->
    <div class="flex items-center gap-1 p-1 rounded-xl bg-[#141414] border border-white/[0.06] text-xs">
      <button
        type="button"
        onclick={() => (activeTab = "overview")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'overview'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Layers class="w-3.5 h-3.5" />
        <span>Visão Integrada</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "chartOnly")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'chartOnly'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <PieChart class="w-3.5 h-3.5" />
        <span>Gráfico</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "tableOnly")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'tableOnly'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Table class="w-3.5 h-3.5" />
        <span>Tabela</span>
      </button>
    </div>
  </div>

  <!-- Chart & Visual Distribution Section -->
  {#if activeTab === "overview" || activeTab === "chartOnly"}
    <div class="p-4 rounded-2xl bg-[#181818]/90 border border-white/[0.08] shadow-inner space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <!-- Donut Chart SVG -->
        <div class="md:col-span-5 flex flex-col items-center justify-center relative py-2">
          <div class="relative w-48 h-48 flex items-center justify-center">
            <svg viewBox="0 0 180 180" class="w-full h-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <!-- Background Circle Track -->
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                stroke-width="18"
              />

              <!-- Colored Slices -->
              {#each slices as slice}
                {@const isHovered = hoveredIndex === slice.index}
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  stroke-width={isHovered ? 22 : 18}
                  stroke-dasharray="{slice.dashLength} {circumference - slice.dashLength}"
                  stroke-dashoffset={slice.offset}
                  transform="rotate(-90 90 90)"
                  class="transition-all duration-200 cursor-pointer {isHovered ? 'opacity-100 filter brightness-125' : hoveredIndex !== null ? 'opacity-40' : 'opacity-90'}"
                  onmouseenter={() => (hoveredIndex = slice.index)}
                  onmouseleave={() => (hoveredIndex = null)}
                  role="graphics-symbol"
                  aria-label="{slice.label}: {slice.percentageFormatted}"
                />
              {/each}
            </svg>

            <!-- Center Donut Content -->
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              {#if activeItem}
                <span class="text-[10px] text-zinc-400 uppercase tracking-wider font-medium truncate max-w-[120px]">
                  {activeItem.label}
                </span>
                <span class="text-lg font-bold text-zinc-100" style="color: {activeItem.color}">
                  {activeItem.percentageFormatted}
                </span>
                {#if activeItem.value}
                  <span class="text-[10px] text-zinc-400 font-medium">
                    {activeItem.value}
                  </span>
                {/if}
              {:else}
                <span class="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                  Patrimônio
                </span>
                <span class="text-sm font-bold text-zinc-100">
                  {data.totalValue || "100%"}
                </span>
                <span class="text-[10px] text-zinc-400">
                  {data.items.length} Classes
                </span>
              {/if}
            </div>
          </div>
          <span class="text-[10px] text-zinc-400 mt-1">Passe o cursor sobre os segmentos</span>
        </div>

        <!-- Allocation Breakdown Legend & Progress Bars -->
        <div class="md:col-span-7 space-y-2.5">
          {#each data.items as item, idx}
            {@const isHovered = hoveredIndex === idx}
            <div
              class="p-2.5 rounded-xl border transition-all cursor-pointer {isHovered
                ? 'bg-white/[0.08] border-white/[0.2] shadow-md -translate-y-0.5'
                : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.05]'}"
              onmouseenter={() => (hoveredIndex = idx)}
              onmouseleave={() => (hoveredIndex = null)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-center justify-between text-xs mb-1.5">
                <div class="flex items-center gap-2 truncate pr-2">
                  <span
                    class="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style="background-color: {item.color}"
                  ></span>
                  <span class="font-medium text-zinc-200 truncate {isHovered ? 'text-zinc-50 font-semibold' : ''}">
                    {item.label}
                  </span>
                  {#if item.category}
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.04]">
                      {item.category}
                    </span>
                  {/if}
                </div>

                <div class="flex items-center gap-2.5 shrink-0">
                  {#if item.value}
                    <span class="text-[11px] text-zinc-400 font-medium">
                      {item.value}
                    </span>
                  {/if}
                  <span
                    class="px-2 py-0.5 rounded-md text-[11px] font-bold"
                    style="background-color: {item.color}25; color: {item.color}; border: 1px solid {item.color}40;"
                  >
                    {item.percentageFormatted}
                  </span>
                </div>
              </div>

              <!-- Mini Progress Bar -->
              <div class="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style="width: {(item.percentage / totalSum) * 100}%; background-color: {item.color};"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Tabular Detailed Markdown Section -->
  {#if activeTab === "overview" || activeTab === "tableOnly"}
    <div class="space-y-2 pt-1">
      {#if activeTab === "overview"}
        <div class="flex items-center gap-2 text-xs font-semibold text-zinc-300 px-1 pt-2">
          <Table class="w-3.5 h-3.5 text-emerald-400" />
          <span>Detalhamento Analítico & Posições</span>
        </div>
      {/if}

      <div class="w-full text-sm text-zinc-200 leading-relaxed font-normal space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-2 [&_li]:my-0.5 [&_li]:text-zinc-200 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#181818] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-2 [&_ol>li]:my-0.5 [&_ol>li]:text-zinc-200 [&_ol>li]:leading-relaxed [&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse [&_table]:rounded-xl [&_table]:overflow-hidden [&_th]:bg-white/[0.08] [&_th]:p-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-zinc-200 [&_th]:border-b [&_th]:border-white/[0.1] [&_td]:p-2.5 [&_td]:text-xs [&_td]:text-zinc-300 [&_td]:border-b [&_td]:border-white/[0.04] [&_tr:hover]:bg-white/[0.03]">
        {@html renderMarkdown(rawText)}
      </div>
    </div>
  {/if}

  <!-- Card Footer -->
  <div class="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Audited Source:</span>
      <span class="text-zinc-200 font-medium">{source || "staggi-portfolio • Alocação Fiduciária"}</span>
    </div>
    <span class="text-zinc-500">Distribuição Dinâmica de Ativos</span>
  </div>
</div>
