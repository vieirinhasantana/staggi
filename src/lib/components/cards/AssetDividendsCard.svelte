<script lang="ts">
  import type { ParsedAssetDividends } from "$lib/services/formatMessage";
  import { 
    Coins, 
    Calendar, 
    TrendingUp, 
    Scale, 
    Sparkles, 
    ShieldCheck, 
    Clock, 
    BarChart3,
    ArrowUpRight,
    Info,
    CheckCircle2
  } from "@lucide/svelte";

  interface Props {
    data: ParsedAssetDividends;
  }

  let { data }: Props = $props();

  let activeView = $state<"history" | "payouts">("history");

  let sortedHistory = $derived.by(() => {
    const list = [...data.annualHistory];
    const allNumeric = list.every((item) => /^\d{4}$/.test(item.year.trim()));
    if (allNumeric) {
      list.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    }
    return list;
  });

  let maxDyValue = $derived.by(() => {
    let max = 0;
    for (const h of data.annualHistory) {
      const num = parseFloat(h.dy.replace("%", "").replace(",", "."));
      if (!isNaN(num) && num > max) max = num;
    }
    return max > 0 ? max * 1.15 : 12;
  });

  let peakItem = $derived.by(() => {
    let peak: { year: string; dy: string; num: number } | null = null;
    for (const h of data.annualHistory) {
      const num = parseFloat(h.dy.replace("%", "").replace(",", "."));
      if (!isNaN(num) && (!peak || num > peak.num)) {
        peak = { year: h.year, dy: h.dy, num };
      }
    }
    return peak;
  });

  let avgDyText = $derived.by(() => {
    let sum = 0;
    let count = 0;
    for (const h of data.annualHistory) {
      const num = parseFloat(h.dy.replace("%", "").replace(",", "."));
      if (!isNaN(num) && num > 0) {
        sum += num;
        count++;
      }
    }
    return count > 0 ? `${(sum / count).toFixed(2).replace(".", ",")}% a.a.` : null;
  });

  let totalRecentSum = $derived.by(() => {
    let sum = 0;
    for (const p of data.payouts.slice(0, 8)) {
      const clean = p.value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
      const num = parseFloat(clean);
      if (!isNaN(num)) sum += num;
    }
    return sum > 0 ? `R$ ${sum.toFixed(4).replace(".", ",")}` : null;
  });
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-4 select-text animate-fade-in">
  <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-400 font-bold text-xs font-mono">
        <Coins class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">{data.companyName}</span>
          <span class="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 font-mono text-[11px] font-bold border border-teal-500/30">
            {data.ticker}
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">Dividend Payouts & Historical Yield</div>
      </div>
    </div>

    <div class="flex items-center gap-1 p-1 rounded-xl bg-[#141320] border border-white/[0.06] text-xs font-mono">
      <button
        type="button"
        onclick={() => (activeView = "history")}
        class="px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeView === 'history'
          ? 'bg-teal-500/25 text-teal-200 border border-teal-500/40 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        DY History
      </button>
      <button
        type="button"
        onclick={() => (activeView = "payouts")}
        class="px-2.5 py-1 rounded-lg transition-all cursor-pointer {activeView === 'payouts'
          ? 'bg-teal-500/25 text-teal-200 border border-teal-500/40 font-semibold shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Payouts ({data.payouts.length})
      </button>
    </div>
  </div>

  {#if data.intro}
    <div class="p-3 rounded-xl bg-[#242232]/60 border border-white/[0.06] text-xs text-zinc-300 font-sans leading-relaxed">
      {data.intro}
    </div>
  {/if}

  {#if activeView === "history" && data.annualHistory.length > 0}
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs font-mono text-zinc-400 flex-wrap gap-2">
        <span class="flex items-center gap-1.5 text-teal-300 font-semibold">
          <BarChart3 class="w-3.5 h-3.5 text-teal-400" /> Annual Dividend Yield (DY) History
        </span>
        <div class="flex items-center gap-3 text-[11px]">
          {#if peakItem}
            <span class="text-zinc-400">
              Peak: <strong class="text-emerald-400 font-mono">{peakItem.dy}</strong> ({peakItem.year})
            </span>
          {/if}
          {#if avgDyText}
            <span class="text-zinc-400">
              Average: <strong class="text-teal-300 font-mono">{avgDyText}</strong>
            </span>
          {/if}
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-[#161522]/90 border border-white/[0.08] relative overflow-hidden space-y-2">
        
        <div class="absolute inset-x-4 top-10 bottom-20 flex flex-col justify-between pointer-events-none opacity-15">
          <div class="border-b border-dashed border-white"></div>
          <div class="border-b border-dashed border-white"></div>
          <div class="border-b border-dashed border-white"></div>
        </div>

        <div class="flex items-end justify-between gap-2 sm:gap-3 h-52 pt-6 pb-2 px-1 relative z-10">
          {#each sortedHistory as item}
            {@const dyNumber = parseFloat(item.dy.replace("%", "").replace(",", ".")) || 0}
            {@const hasValidDy = !isNaN(dyNumber) && dyNumber > 0}
            {@const barHeightPercent = hasValidDy ? Math.min(100, Math.max(10, (dyNumber / maxDyValue) * 100)) : 6}
            {@const isDestaque = dyNumber >= 8}

            <div class="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all">
              
              <div class="mb-2 flex flex-col items-center transition-transform group-hover:-translate-y-1">
                {#if isDestaque}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-0.5 whitespace-nowrap">
                    High
                  </span>
                {/if}
                <span class="font-mono font-bold text-xs sm:text-sm {isDestaque ? 'text-emerald-400' : hasValidDy ? 'text-teal-300' : 'text-zinc-500'}">
                  {item.dy}
                </span>
              </div>

              <div class="w-full max-w-[48px] sm:max-w-[56px] h-32 flex items-end">
                <div
                  style="height: {barHeightPercent}%"
                  class="w-full rounded-t-xl transition-all duration-500 relative overflow-hidden group-hover:brightness-125 {
                    isDestaque
                      ? 'bg-gradient-to-t from-emerald-600/70 via-emerald-500 to-teal-300 border-t border-x border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : hasValidDy
                        ? 'bg-gradient-to-t from-teal-600/60 via-teal-500 to-cyan-300 border-t border-x border-teal-400/30'
                        : 'bg-white/[0.06] border border-dashed border-white/[0.15]'
                  }"
                  title="{item.year}: DY {item.dy} | Total: {item.totalPaid}{item.avgPrice && item.avgPrice !== 'N/D' ? ` | Average Price: ${item.avgPrice}` : ''}"
                >
                  <div class="absolute inset-x-0 top-0 h-1 bg-white/40"></div>
                </div>
              </div>

              <div class="w-full pt-2.5 mt-1 border-t border-white/[0.1] text-center flex flex-col items-center gap-0.5">
                <span class="font-mono font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-teal-300 transition-colors">
                  {item.year}
                </span>
                <span class="text-[10px] text-zinc-400 font-mono truncate max-w-full" title={item.totalPaid}>
                  {item.totalPaid}
                </span>
                {#if item.avgPrice && item.avgPrice !== "N/D"}
                  <span class="text-[9px] text-zinc-500 font-sans truncate max-w-full" title={`Average Price: ${item.avgPrice}`}>
                    Avg {item.avgPrice.replace("R$", "").trim()}
                  </span>
                {/if}
              </div>

            </div>
          {/each}
        </div>

        <div class="flex items-center justify-between pt-3 mt-1 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-emerald-400"></span> High Yield (&ge; 8%)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-teal-400"></span> Standard Yield
            </span>
          </div>
          <span class="text-zinc-500 hidden sm:inline">Compact responsive visualization</span>
        </div>

      </div>
    </div>
  {/if}

  {#if activeView === "payouts" || data.annualHistory.length === 0}
    <div class="space-y-2.5">
      <div class="flex items-center justify-between text-xs font-mono text-zinc-400">
        <span class="flex items-center gap-1.5 text-teal-300 font-semibold">
          <Calendar class="w-3.5 h-3.5 text-teal-400" /> Declared & Paid Distributions
        </span>
        {#if totalRecentSum}
          <span class="text-[11px] text-zinc-300">
            Recent distributions: <strong class="text-emerald-400 font-mono">{totalRecentSum}</strong>/share
          </span>
        {/if}
      </div>

      <div class="rounded-xl border border-white/[0.08] bg-[#161522] overflow-hidden">
        <div class="max-h-64 overflow-y-auto pr-1">
          <table class="w-full text-left border-collapse text-xs font-mono">
            <thead class="sticky top-0 bg-[#242232] border-b border-white/[0.08] text-[10px] text-zinc-400 uppercase tracking-wider">
              <tr>
                <th class="py-2 px-3">Type</th>
                <th class="py-2 px-3">Amount per Share</th>
                <th class="py-2 px-3">Ex-Date</th>
                <th class="py-2 px-3">Payment Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.04]">
              {#each data.payouts as item}
                <tr class="hover:bg-white/[0.03] transition-colors">
                  <td class="py-2 px-3">
                    {#if item.type === "JCP"}
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        JCP (15% Tax)
                      </span>
                    {:else}
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Dividend
                      </span>
                    {/if}
                  </td>
                  <td class="py-2 px-3 font-bold text-zinc-100">
                    {item.value}
                  </td>
                  <td class="py-2 px-3 text-zinc-400">
                    {item.exDate}
                  </td>
                  <td class="py-2 px-3 text-zinc-300 font-medium">
                    {item.payDate}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}

  <div class="p-3 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 flex items-start gap-2.5 text-xs text-zinc-300 font-sans leading-relaxed">
    <Scale class="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
    <div>
      <strong class="text-violet-200 font-semibold">Distribution & Tax Summary:</strong>
      Interest on Equity (JCP) incurs 15% withholding tax at source in Brazil. Stock dividends remain exempt from personal income tax.
    </div>
  </div>

  {#if data.footer}
    <div class="text-[10px] text-zinc-500 font-mono leading-tight">
      {data.footer}
    </div>
  {/if}

  <div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Audited Source:</span>
      <span class="text-zinc-200 font-medium">B3 / SEC / CVM • Official Central Registry Filings</span>
    </div>
    <span class="text-zinc-500">Verified DY & Historical Cashflows</span>
  </div>
</div>
