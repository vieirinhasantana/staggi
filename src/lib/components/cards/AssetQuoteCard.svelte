<script lang="ts">
  import type { ParsedAssetQuote } from "$lib/services/formatMessage";
  import { 
    TrendingUp, 
    TrendingDown, 
    Server, 
    Coins, 
    BarChart3, 
    Layers, 
    Calendar,
    Megaphone,
    Building2,
    ShieldCheck
  } from "@lucide/svelte";

  interface Props {
    quote: ParsedAssetQuote;
  }

  let { quote }: Props = $props();
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/90 backdrop-blur-xl shadow-lg p-4 space-y-3.5 select-text">
  <!-- Cabeçalho do Ativo com MCP e Ticker -->
  <div class="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 font-bold text-xs font-mono">
        <Building2 class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">{quote.companyName}</span>
          <span class="px-2 py-0.5 rounded-md bg-white/[0.08] text-zinc-300 font-mono text-[11px] font-bold border border-white/[0.08]">
            {quote.ticker}
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">Cotação & Indicadores de Mercado</div>
      </div>
    </div>

    <!-- Badge de Fonte Auditada -->
    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono font-semibold">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
      <span>Fonte: B3 / NYSE (Yahoo Finance)</span>
    </div>
  </div>

  <!-- Bloco Principal de Preço e Variação -->
  <div class="flex items-baseline justify-between pt-1">
    <div>
      <div class="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Preço de Mercado</div>
      <div class="text-2xl font-bold font-mono text-zinc-100 tracking-tight">
        {quote.price}
      </div>
      {#if quote.dateInfo}
        <div class="text-[10px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
          <Calendar class="w-2.5 h-2.5" />
          <span>{quote.dateInfo}</span>
        </div>
      {/if}
    </div>

    <!-- Variação com Indicador Visual -->
    <div class="flex flex-col items-end">
      <div class="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Variação Diária</div>
      <div class="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold mt-1 {quote.isPositive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
        {#if quote.isPositive}
          <TrendingUp class="w-3.5 h-3.5 text-emerald-400" />
        {:else}
          <TrendingDown class="w-3.5 h-3.5 text-rose-400" />
        {/if}
        <span>{quote.change}</span>
      </div>
    </div>
  </div>

  <!-- Grade de Múltiplos e Indicadores (DY, P/L, P/VP) -->
  <div class="grid grid-cols-3 gap-2.5 pt-1">
    <!-- Dividend Yield -->
    <div class="p-2.5 rounded-xl bg-[#242232]/70 border border-white/[0.06] space-y-1">
      <div class="flex items-center gap-1 text-[10px] font-mono text-zinc-400 uppercase">
        <Coins class="w-3 h-3 text-amber-400" />
        <span>Div. Yield (LTM)</span>
      </div>
      <div class="text-sm font-bold font-mono text-amber-300">
        {quote.dividendYield || '—'}
      </div>
    </div>

    <!-- P/L -->
    <div class="p-2.5 rounded-xl bg-[#242232]/70 border border-white/[0.06] space-y-1">
      <div class="flex items-center gap-1 text-[10px] font-mono text-zinc-400 uppercase">
        <BarChart3 class="w-3 h-3 text-sky-400" />
        <span>P/L (TTM)</span>
      </div>
      <div class="text-sm font-bold font-mono text-zinc-200">
        {quote.pl || '—'}
      </div>
    </div>

    <!-- P/VP -->
    <div class="p-2.5 rounded-xl bg-[#242232]/70 border border-white/[0.06] space-y-1">
      <div class="flex items-center gap-1 text-[10px] font-mono text-zinc-400 uppercase">
        <Layers class="w-3 h-3 text-violet-400" />
        <span>P/VP</span>
      </div>
      <div class="text-sm font-bold font-mono text-zinc-200">
        {quote.pvp || '—'}
      </div>
    </div>
  </div>

  <!-- Destaque para Fato Relevante Recente -->
  {#if quote.relevantFact}
    <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs animate-fade-in">
      <div class="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px] font-mono">
        <Megaphone class="w-3.5 h-3.5 text-amber-400" />
        <span>Fato Relevante & Proventos Recentes</span>
      </div>
      <p class="text-zinc-200 leading-relaxed font-sans text-xs">
        {quote.relevantFact}
      </p>
    </div>
  {/if}
</div>
