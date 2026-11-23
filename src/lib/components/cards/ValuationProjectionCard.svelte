<script lang="ts">
  import type { ParsedValuationProjection } from "$lib/services/formatMessage";
  import { 
    Calculator, 
    TrendingUp, 
    ShieldCheck, 
    Target, 
    Coins, 
    Percent, 
    BarChart2, 
    Scale,
    Sparkles,
    CheckCircle2
  } from "@lucide/svelte";

  interface Props {
    data: ParsedValuationProjection;
  }

  let { data }: Props = $props();
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#212121]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-4 select-text animate-fade-in">
  <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-bold text-xs">
        <Calculator class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">{data.companyName}</span>
          <span class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
            {data.ticker}
          </span>
        </div>
        <div class="text-[11px] text-zinc-400">Valuation Model, Ceiling Price & Multiples</div>
      </div>
    </div>

    {#if data.recommendation}
      <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 flex items-center gap-1">
        <Sparkles class="w-3 h-3 text-emerald-400" />
        {data.recommendation}
      </span>
    {/if}
  </div>

  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
    {#if data.currentPrice}
      <div class="p-2.5 rounded-xl bg-[#262626]/80 border border-white/[0.06] space-y-1">
        <span class="text-[10px] text-zinc-400 uppercase tracking-wider block">Current Price</span>
        <div class="text-sm font-bold text-zinc-100">{data.currentPrice}</div>
      </div>
    {/if}

    {#if data.bazinCeilingPrice}
      <div class="p-2.5 rounded-xl bg-[#262626]/80 border border-emerald-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-emerald-400 uppercase tracking-wider block">Bazin Ceiling (6% DY)</span>
          <Coins class="w-3 h-3 text-emerald-400" />
        </div>
        <div class="text-sm font-bold text-emerald-300">{data.bazinCeilingPrice}</div>
      </div>
    {/if}

    {#if data.grahamPrice}
      <div class="p-2.5 rounded-xl bg-[#262626]/80 border border-sky-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-sky-400 uppercase tracking-wider block">Graham Fair Value</span>
          <Scale class="w-3 h-3 text-sky-400" />
        </div>
        <div class="text-sm font-bold text-sky-300">{data.grahamPrice}</div>
      </div>
    {/if}

    {#if data.safetyMargin || data.targetPrice}
      <div class="p-2.5 rounded-xl bg-[#262626]/80 border border-amber-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-amber-400 uppercase tracking-wider block">Margin / Upside</span>
          <Target class="w-3 h-3 text-amber-400" />
        </div>
        <div class="text-sm font-bold text-amber-300">{data.safetyMargin || data.targetPrice}</div>
      </div>
    {/if}
  </div>

  {#if data.pl || data.pvp || data.roe || data.projectedDy}
    <div class="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-white/[0.05] text-[11px] flex-wrap gap-2">
      {#if data.pl}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">P/E:</span>
          <strong class="text-zinc-200">{data.pl}</strong>
        </div>
      {/if}
      {#if data.pvp}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">P/B:</span>
          <strong class="text-zinc-200">{data.pvp}</strong>
        </div>
      {/if}
      {#if data.roe}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">ROE:</span>
          <strong class="text-emerald-400">{data.roe}</strong>
        </div>
      {/if}
      {#if data.projectedDy}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">Projected DY:</span>
          <strong class="text-emerald-400">{data.projectedDy}</strong>
        </div>
      {/if}
    </div>
  {/if}

  {#if data.summary}
    <p class="text-xs text-zinc-300 font-sans leading-relaxed border-l-2 border-emerald-500/50 pl-3 my-1">
      {data.summary}
    </p>
  {/if}

  <div class="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Audited Source:</span>
      <span class="text-zinc-200 font-medium">IFRS Financials / SEC / CVM • Sell-Side Consensus • Live Market Data</span>
    </div>
    <span class="text-zinc-500">Graham & Bazin Valuation</span>
  </div>
</div>
