<script lang="ts">
  import type { ParsedPortfolioDistribution } from "$lib/types";
  import { renderMarkdown } from "$lib/services/formatMessage";
  import { exportReportAsPdf, sendClientEmail } from "$lib/services/pdfExportService";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { 
    PieChart, 
    Layers, 
    Table, 
    ShieldCheck, 
    Sparkles, 
    TrendingUp, 
    UserCheck, 
    Wallet,
    FileDown,
    Mail,
    Copy,
    Check,
    Target,
    Scale,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    ArrowRight,
    BarChart2
  } from "@lucide/svelte";

  interface Props {
    data: ParsedPortfolioDistribution;
    rawText: string;
    source?: string;
  }

  let { data, rawText, source }: Props = $props();

  let activeTab = $state<"overview" | "compare" | "chartOnly" | "tableOnly">("overview");
  let hoveredIndex = $state<number | null>(null);
  let isCopied = $state(false);

  const hasCompareData = $derived(
    data.items.some(it => it.currentPercentage !== undefined && it.targetPercentage !== undefined)
  );

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

  // Maximum percentage across current and target for scaling comparative bar charts
  const maxComparePct = $derived.by(() => {
    let max = 0;
    for (const it of data.items) {
      if (it.currentPercentage && it.currentPercentage > max) max = it.currentPercentage;
      if (it.targetPercentage && it.targetPercentage > max) max = it.targetPercentage;
      if (it.percentage > max) max = it.percentage;
    }
    return Math.max(max, 10);
  });

  function handleExportPdf() {
    const donutSvg = `
      <svg viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="18" />
        ${slices.map(s => `
          <circle cx="90" cy="90" r="${radius}" fill="none" stroke="${s.color}" stroke-width="18"
            stroke-dasharray="${s.dashLength} ${circumference - s.dashLength}"
            stroke-dashoffset="${s.offset}" transform="rotate(-90 90 90)" />
        `).join('')}
      </svg>
    `;

    const metrics = [
      { label: "Total AUM", value: data.totalValue || "100%" },
      { label: "Allocated Classes", value: `${data.items.length} Categories` },
      { label: "Status", value: data.isRebalancing ? "Target Structure" : "Strategic Allocation" },
      { label: "Strategy", value: data.isRebalancing ? "Fiduciary Rebalance" : "Multi-Asset Fiduciary" }
    ];

    exportReportAsPdf({
      title: data.title,
      subtitle: data.isRebalancing 
        ? "Executive Report: Portfolio Rebalancing & Optimized Target Allocation"
        : "Portfolio Asset Allocation & Class Distribution Report",
      clientName: data.clientName,
      auditedSource: source || "Staggi Wealth Management",
      metrics,
      allocations: data.items.map(it => ({
        label: it.label,
        percentage: it.percentage,
        percentageFormatted: it.percentageFormatted,
        currentPercentage: it.currentPercentage,
        currentPercentageFormatted: it.currentPercentageFormatted,
        targetPercentage: it.targetPercentage,
        targetPercentageFormatted: it.targetPercentageFormatted,
        deltaPercentage: it.deltaPercentage,
        deltaFormatted: it.deltaFormatted,
        action: it.action,
        value: it.value,
        color: it.color
      })),
      totalValue: data.totalValue,
      isRebalancing: data.isRebalancing,
      chartSvg: donutSvg,
      rawMarkdown: rawText,
      verdict: data.isRebalancing
        ? "Rebalance formulated to realign the portfolio with Investment Policy Statement (IPS) guidelines and risk-return optimization."
        : "Portfolio structured in full compliance with strategic asset diversification guidelines."
    });
  }

  function handleSendEmail() {
    sendClientEmail({
      clientName: data.clientName,
      subject: data.isRebalancing 
        ? `Consolidated Target Structure (Post-Rebalance) • ${data.clientName || 'Wealth Advisory'}`
        : `Portfolio Allocation • ${data.clientName || 'Wealth Advisory'}`,
      metrics: [
        { label: "Total AUM", value: data.totalValue || "100%" },
        { label: "Target Allocations", value: data.items.map(i => `${i.label} (${i.percentageFormatted})`).join(", ") }
      ],
      summary: `Dear Client, please find below the ${data.isRebalancing ? 'proposed post-rebalance target structure' : 'updated portfolio distribution'} (${data.totalValue || '100%'}):\n\n` +
        data.items.map(i => {
          let line = `• ${i.label}: ${i.percentageFormatted}`;
          if (i.currentPercentageFormatted) {
            line += ` (Current: ${i.currentPercentageFormatted} ➔ Target: ${i.targetPercentageFormatted || i.percentageFormatted}`;
            if (i.deltaFormatted) line += `, Adjustment: ${i.deltaFormatted}`;
            if (i.action) line += ` - ${i.action}`;
            line += `)`;
          }
          if (i.value) line += ` [${i.value}]`;
          return line;
        }).join("\n")
    });
  }

  function handleCopySummary() {
    const summary = `${data.title}${data.clientName ? ` - ${data.clientName}` : ''}\nTotal: ${data.totalValue || '100%'}\n\n` +
      data.items.map(i => {
        let line = `• ${i.label}: ${i.percentageFormatted}`;
        if (i.currentPercentageFormatted) {
          line += ` (Current: ${i.currentPercentageFormatted} ➔ Target: ${i.targetPercentageFormatted || i.percentageFormatted}`;
          if (i.deltaFormatted) line += `, Adjustment: ${i.deltaFormatted}`;
          line += `)`;
        }
        if (i.value) line += ` [${i.value}]`;
        return line;
      }).join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary);
      isCopied = true;
      toastStore.showToast("Portfolio summary copied!", "success");
      setTimeout(() => (isCopied = false), 2000);
    }
  }
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#212121]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-4 select-text">
  <!-- Card Header -->
  <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
    <div class="flex items-center gap-3">
      <div class="h-9 w-9 rounded-xl {data.isRebalancing ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' : 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'} flex items-center justify-center font-bold text-xs shadow-inner">
        {#if data.isRebalancing}
          <Target class="w-4 h-4" />
        {:else}
          <PieChart class="w-4 h-4" />
        {/if}
      </div>
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold text-zinc-100">{data.title}</span>
          {#if data.isRebalancing}
            <span class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-bold border border-amber-500/30">
              <Scale class="w-3 h-3" />
              Post-Rebalance
            </span>
          {/if}
          {#if data.clientName}
            <span class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
              <UserCheck class="w-3 h-3" />
              {data.clientName}
            </span>
          {/if}
          <span class="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 text-[11px] font-medium border border-white/[0.08]">
            {data.items.length} Positions
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
          <span>{data.intro || "Asset class and percentage distribution"}</span>
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
    <div class="flex items-center gap-1 p-1 rounded-xl bg-[#141414] border border-white/[0.06] text-xs flex-wrap">
      <button
        type="button"
        onclick={() => (activeTab = "overview")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'overview'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Layers class="w-3.5 h-3.5" />
        <span>Overview</span>
      </button>

      {#if hasCompareData}
        <button
          type="button"
          onclick={() => (activeTab = "compare")}
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'compare'
            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/35 font-semibold shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <BarChart2 class="w-3.5 h-3.5" />
          <span>Current vs Target</span>
        </button>
      {/if}

      <button
        type="button"
        onclick={() => (activeTab = "chartOnly")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'chartOnly'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <PieChart class="w-3.5 h-3.5" />
        <span>Target Donut</span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "tableOnly")}
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeTab === 'tableOnly'
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Table class="w-3.5 h-3.5" />
        <span>Table</span>
      </button>
    </div>
  </div>

  <!-- Overview View (Donut + Breakdown) -->
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
                {#if activeItem.deltaFormatted}
                  <span class="text-[10px] font-semibold {activeItem.deltaPercentage && activeItem.deltaPercentage > 0 ? 'text-emerald-400' : activeItem.deltaPercentage && activeItem.deltaPercentage < 0 ? 'text-rose-400' : 'text-zinc-400'}">
                    Adjustment: {activeItem.deltaFormatted}
                  </span>
                {/if}
              {:else}
                <span class="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                  {data.isRebalancing ? "Target Structure" : "Total AUM"}
                </span>
                <span class="text-sm font-bold text-zinc-100">
                  {data.totalValue || "100%"}
                </span>
                <span class="text-[10px] text-zinc-400">
                  {data.items.length} Positions
                </span>
              {/if}
            </div>
          </div>
          <span class="text-[10px] text-zinc-400 mt-1">
            {data.isRebalancing ? "Passe o cursor para auditar a alocação alvo" : "Passe o cursor sobre os segmentos"}
          </span>
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
              <div class="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1">
                <div class="flex items-center gap-2 truncate pr-2 max-w-[60%]">
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

                <div class="flex items-center gap-2 shrink-0">
                  <!-- Current to Target transition display -->
                  {#if item.currentPercentageFormatted && item.targetPercentageFormatted}
                    <div class="flex items-center gap-1 text-[11px] text-zinc-400">
                      <span class="text-zinc-500 line-through text-[10px]">{item.currentPercentageFormatted}</span>
                      <ArrowRight class="w-2.5 h-2.5 text-zinc-500" />
                    </div>
                  {/if}

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

                  <!-- Delta Badge -->
                  {#if item.deltaFormatted}
                    {@const isPositive = item.deltaPercentage && item.deltaPercentage > 0}
                    {@const isNegative = item.deltaPercentage && item.deltaPercentage < 0}
                    <span class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border {isPositive
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                      : isNegative
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                      : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25'}">
                      {#if isPositive}
                        <ArrowUpRight class="w-3 h-3" />
                      {:else if isNegative}
                        <ArrowDownRight class="w-3 h-3" />
                      {:else}
                        <Minus class="w-3 h-3" />
                      {/if}
                      <span>{item.deltaFormatted}</span>
                      {#if item.action}
                        <span class="opacity-75 font-normal ml-0.5">({item.action})</span>
                      {/if}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Mini Progress Bar -->
              <div class="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden relative">
                {#if item.currentPercentage !== undefined}
                  <!-- Current reference marker -->
                  <div
                    class="absolute top-0 bottom-0 bg-white/20 rounded-full"
                    style="width: {(item.currentPercentage / totalSum) * 100}%;"
                    title="Alocação Atual: {item.currentPercentageFormatted}"
                  ></div>
                {/if}
                <!-- Target bar -->
                <div
                  class="h-full rounded-full transition-all duration-300 relative z-10"
                  style="width: {(item.percentage / totalSum) * 100}%; background-color: {item.color};"
                  title="Alocação Alvo: {item.percentageFormatted}"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Comparative Side-by-Side Tab (Atual vs Alvo) -->
  {#if activeTab === "compare"}
    <div class="p-4 rounded-2xl bg-[#181818]/90 border border-white/[0.08] shadow-inner space-y-4">
      <div class="flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs">
        <span class="font-semibold text-zinc-200 flex items-center gap-1.5">
          <Scale class="w-4 h-4 text-amber-400" />
          Movement Audit: Current Allocation vs Target Structure
        </span>
        <div class="flex items-center gap-3 text-[11px]">
          <div class="flex items-center gap-1.5 text-zinc-400">
            <span class="h-2 w-4 rounded-sm bg-zinc-600 inline-block"></span>
            <span>Current</span>
          </div>
          <div class="flex items-center gap-1.5 text-zinc-200">
            <span class="h-2 w-4 rounded-sm bg-emerald-500 inline-block"></span>
            <span>Proposed Target</span>
          </div>
        </div>
      </div>

      <div class="space-y-3.5">
        {#each data.items as item}
          {@const curr = item.currentPercentage ?? 0}
          {@const target = item.targetPercentage ?? item.percentage}
          {@const isPositive = item.deltaPercentage && item.deltaPercentage > 0}
          {@const isNegative = item.deltaPercentage && item.deltaPercentage < 0}

          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div class="flex items-center justify-between text-xs flex-wrap gap-1">
              <span class="font-semibold text-zinc-100 flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full" style="background-color: {item.color}"></span>
                {item.label}
              </span>

              <div class="flex items-center gap-2">
                {#if item.deltaFormatted}
                  <span class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border {isPositive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : isNegative
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'}">
                    {#if isPositive}
                      <ArrowUpRight class="w-3.5 h-3.5" />
                    {:else if isNegative}
                      <ArrowDownRight class="w-3.5 h-3.5" />
                    {:else}
                      <Minus class="w-3.5 h-3.5" />
                    {/if}
                    <span>{item.deltaFormatted}</span>
                    {#if item.action}
                      <span class="font-medium">({item.action})</span>
                    {/if}
                  </span>
                {/if}

                {#if item.value}
                  <span class="text-[11px] text-zinc-400 font-mono">
                    {item.value}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Double horizontal bars -->
            <div class="space-y-1.5 pt-0.5">
              <!-- Current Bar -->
              <div class="flex items-center gap-2 text-[11px]">
                <span class="w-12 text-zinc-500 text-right shrink-0">Current:</span>
                <div class="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    class="h-full rounded-full bg-zinc-500 transition-all duration-300"
                    style="width: {(curr / maxComparePct) * 100}%;"
                  ></div>
                </div>
                <span class="w-12 text-right font-mono text-zinc-400 text-xs">
                  {item.currentPercentageFormatted || `${curr.toFixed(1)}%`}
                </span>
              </div>

              <!-- Target Bar -->
              <div class="flex items-center gap-2 text-[11px]">
                <span class="w-12 text-emerald-400 font-medium text-right shrink-0">Target:</span>
                <div class="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    style="width: {(target / maxComparePct) * 100}%; background-color: {item.color};"
                  ></div>
                </div>
                <span class="w-12 text-right font-mono font-bold text-xs" style="color: {item.color}">
                  {item.targetPercentageFormatted || item.percentageFormatted}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Tabular Detailed Markdown Section -->
  {#if activeTab === "overview" || activeTab === "tableOnly"}
    <div class="space-y-2 pt-1">
      {#if activeTab === "overview"}
        <div class="flex items-center gap-2 text-xs font-semibold text-zinc-300 px-1 pt-2">
          <Table class="w-3.5 h-3.5 text-emerald-400" />
          <span>Analytical Breakdown & Positions</span>
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
      <span class="text-zinc-200 font-medium">{source || (data.isRebalancing ? "Fiduciary Optimization" : "Asset Allocation")}</span>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-zinc-500">{data.isRebalancing ? "Consolidated Target Structure" : "Dynamic Asset Allocation"}</span>
      <button
        type="button"
        onclick={handleCopySummary}
        title="Copy portfolio text summary"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 text-[10px] transition-colors cursor-pointer"
      >
        {#if isCopied}
          <Check class="w-3 h-3 text-emerald-400" />
          <span class="text-emerald-300">Copied</span>
        {:else}
          <Copy class="w-3 h-3" />
          <span>Copy</span>
        {/if}
      </button>
    </div>
  </div>
</div>
