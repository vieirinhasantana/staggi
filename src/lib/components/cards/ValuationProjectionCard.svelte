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

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-4 select-text animate-fade-in">
  <!-- Cabeçalho de Projeção & Valuation -->
  <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-bold text-xs font-mono">
        <Calculator class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">{data.companyName}</span>
          <span class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
            {data.ticker}
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">Modelo de Projeção, Preço Teto & Valuation</div>
      </div>
    </div>

    {#if data.recommendation}
      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 flex items-center gap-1">
        <Sparkles class="w-3 h-3 text-emerald-400" />
        {data.recommendation}
      </span>
    {/if}
  </div>

  <!-- Métricas Chave em Grid 2x2 ou 4 colunas -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
    <!-- Cotação Atual -->
    {#if data.currentPrice}
      <div class="p-2.5 rounded-xl bg-[#242232]/80 border border-white/[0.06] space-y-1">
        <span class="text-[10px] text-zinc-400 uppercase tracking-wider block">Cotação Atual</span>
        <div class="text-sm font-bold text-zinc-100">{data.currentPrice}</div>
      </div>
    {/if}

    <!-- Preço Teto (Bazin) -->
    {#if data.bazinCeilingPrice}
      <div class="p-2.5 rounded-xl bg-[#242232]/80 border border-emerald-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-emerald-400 uppercase tracking-wider block">Preço Teto (Bazin)</span>
          <Coins class="w-3 h-3 text-emerald-400" />
        </div>
        <div class="text-sm font-bold text-emerald-300">{data.bazinCeilingPrice}</div>
      </div>
    {/if}

    <!-- Preço Justo (Graham) -->
    {#if data.grahamPrice}
      <div class="p-2.5 rounded-xl bg-[#242232]/80 border border-sky-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-sky-400 uppercase tracking-wider block">Preço Justo (Graham)</span>
          <Scale class="w-3 h-3 text-sky-400" />
        </div>
        <div class="text-sm font-bold text-sky-300">{data.grahamPrice}</div>
      </div>
    {/if}

    <!-- Margem de Segurança / Preço Alvo -->
    {#if data.safetyMargin || data.targetPrice}
      <div class="p-2.5 rounded-xl bg-[#242232]/80 border border-amber-500/20 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-amber-400 uppercase tracking-wider block">Margem / Upside</span>
          <Target class="w-3 h-3 text-amber-400" />
        </div>
        <div class="text-sm font-bold text-amber-300">{data.safetyMargin || data.targetPrice}</div>
      </div>
    {/if}
  </div>

  <!-- Indicadores Fundamentalistas Rápidos -->
  {#if data.pl || data.pvp || data.roe || data.projectedDy}
    <div class="flex items-center justify-between p-3 rounded-xl bg-[#161522] border border-white/[0.05] text-[11px] font-mono flex-wrap gap-2">
      {#if data.pl}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">P/L:</span>
          <strong class="text-zinc-200">{data.pl}</strong>
        </div>
      {/if}
      {#if data.pvp}
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">P/VP:</span>
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
          <span class="text-zinc-500">DY Projetado:</span>
          <strong class="text-emerald-400">{data.projectedDy}</strong>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Racional & Síntese da Projeção -->
  {#if data.summary}
    <p class="text-xs text-zinc-300 font-sans leading-relaxed border-l-2 border-emerald-500/50 pl-3 my-1">
      {data.summary}
    </p>
  {/if}

  <!-- Rodapé com Fonte Auditada -->
  <div class="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Fonte Auditada:</span>
      <span class="text-zinc-200 font-medium">Demonstrações IFRS / CVM • Consenso Sell-Side • Market Data</span>
    </div>
    <span class="text-zinc-500">Modelos Graham & Bazin</span>
  </div>
</div>
