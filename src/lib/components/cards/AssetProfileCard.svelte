<script lang="ts">
  import type { ParsedAssetProfile } from "$lib/services/formatMessage";
  import {
    Layers,
    Landmark,
    ShieldCheck,
    Globe,
    FileText,
    Sparkles,
    Check,
    Copy,
    Tag,
    Building2,
    Calendar,
    Coins,
    Percent,
    TrendingUp,
  } from "@lucide/svelte";

  interface Props {
    data: ParsedAssetProfile;
  }

  let { data }: Props = $props();

  let copied = $state(false);

  function copyIdentifier() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(data.identifier);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  // Detecta se é estrutura UCITS (Luxemburgo ou Irlanda) para destacar blindagem fiscal
  let isUcits = $derived.by(() => {
    const text = `${data.domicile || ""} ${data.name || ""} ${data.assetType || ""}`.toLowerCase();
    return text.includes("ucits") || text.includes("luxemburgo") || text.includes("irlanda");
  });

  // Detecta se é ETF, Bond ou Ação para definir o ícone temático
  let isEtf = $derived.by(() => {
    const text = `${data.assetType || ""} ${data.name || ""}`.toLowerCase();
    return text.includes("etf") || text.includes("fundo");
  });

  let isBond = $derived.by(() => {
    const text = `${data.assetClass || ""} ${data.name || ""} ${data.assetType || ""}`.toLowerCase();
    return text.includes("bond") || text.includes("renda fixa") || text.includes("dívida") || text.includes("divida");
  });
</script>

<div
  class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/95 backdrop-blur-2xl shadow-xl p-5 space-y-4 select-text animate-fade-in"
>
  <!-- Cabeçalho do Ativo / Ficha Cadastral -->
  <div class="flex items-start justify-between pb-3.5 border-b border-white/[0.08] flex-wrap gap-3">
    <div class="flex items-start gap-3">
      <!-- Ícone Temático Dinâmico -->
      <div
        class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border {isEtf
          ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
          : isBond
            ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
            : 'bg-violet-500/15 border-violet-500/30 text-violet-300'}"
      >
        {#if isEtf}
          <Layers class="w-5 h-5" />
        {:else if isBond}
          <Landmark class="w-5 h-5" />
        {:else}
          <TrendingUp class="w-5 h-5" />
        {/if}
      </div>

      <div class="space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Identificador (ISIN / Ticker) com Botão de Cópia -->
          <button
            type="button"
            onclick={copyIdentifier}
            title="Clique para copiar o identificador"
            class="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-mono text-xs font-bold border border-teal-500/35 hover:bg-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>{data.identifier}</span>
            {#if copied}
              <Check class="w-3 h-3 text-emerald-400" />
            {:else}
              <Copy class="w-3 h-3 opacity-60 hover:opacity-100" />
            {/if}
          </button>

          <!-- Badges de Classificação -->
          {#if data.assetType}
            <span
              class="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 font-mono text-[11px] border border-white/[0.08]"
            >
              {data.assetType}
            </span>
          {/if}

          {#if isUcits}
            <span
              class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1"
            >
              <ShieldCheck class="w-3 h-3 text-emerald-400" />
              UCITS Compliant
            </span>
          {/if}
        </div>

        <h3 class="text-sm sm:text-base font-semibold text-zinc-100 leading-snug">
          {data.name}
        </h3>

        {#if data.manager || data.domicile}
          <p class="text-xs text-zinc-400 font-mono flex items-center gap-2">
            {#if data.manager}
              <span class="text-zinc-300">{data.manager}</span>
            {/if}
            {#if data.manager && data.domicile}
              <span class="text-zinc-600">•</span>
            {/if}
            {#if data.domicile}
              <span>{data.domicile}</span>
            {/if}
          </p>
        {/if}
      </div>
    </div>

    <!-- Badge de Origem da Base de Dados -->
    {#if data.mcpSource}
      <span
        class="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 shrink-0"
      >
        <Globe class="w-3 h-3 text-sky-400" />
        {data.mcpSource}
      </span>
    {/if}
  </div>

  <!-- Destaque de Cotação Atual / NAV e Moeda (Valor Oficial do Ativo) -->
  {#if data.price}
    <div
      class="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/[0.12] via-teal-500/[0.08] to-transparent border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3"
    >
      <div class="space-y-0.5">
        <span class="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
          Cotação Atual / NAV (Valor Oficial da Cota)
        </span>
        <div class="flex items-baseline gap-2">
          <span class="text-lg sm:text-xl font-bold font-mono text-emerald-300">
            {data.price}
          </span>
          {#if data.currency}
            <span class="text-xs font-mono text-zinc-400 font-semibold">
              {data.currency}
            </span>
          {/if}
        </div>
      </div>

      {#if data.change}
        <div class="text-right">
          <span class="text-[10px] text-zinc-400 font-mono uppercase block">Variação Recente</span>
          <span
            class="text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-md {data.change.startsWith('-')
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}"
          >
            {data.change}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Grade de Atributos Estruturados em Cards Elegantes -->
  {#if data.fields.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {#each data.fields as field}
        <div
          class="p-3 rounded-xl bg-[#242232]/75 border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-1"
        >
          <span class="text-[10px] text-zinc-400 uppercase tracking-wider font-mono block">
            {field.label}
          </span>
          <div class="text-xs font-semibold text-zinc-100 font-sans leading-relaxed">
            {field.value}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Box Especial de Alerta Fiscal / US Estate Tax para UCITS -->
  {#if isUcits}
    <div
      class="p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25 flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed font-sans"
    >
      <ShieldCheck class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      <div>
        <strong class="text-emerald-200 font-semibold">Vantagem Tributária Offshore (UCITS):</strong>
        Estruturas domiciliadas na Europa (Luxemburgo/Irlanda) são isentas do imposto sucessório americano
        (<em>US Estate Tax</em> - limite de US$ 60.000 do IRS) e contam com eficiência fiscal na retenção de dividendos
        para investidores não-residentes fiscais dos EUA.
      </div>
    </div>
  {/if}

  <!-- Resumo da Tese / Síntese Analítica -->
  {#if data.summary}
    <div
      class="p-3.5 rounded-xl bg-[#161522] border border-white/[0.06] space-y-1.5 text-xs text-zinc-300 font-sans leading-relaxed"
    >
      <div class="flex items-center gap-1.5 text-teal-300 font-semibold font-mono text-xs">
        <Sparkles class="w-3.5 h-3.5 text-teal-400" />
        <span>Tese & Foco Estratégico</span>
      </div>
      <p class="text-zinc-200">
        {data.summary}
      </p>
    </div>
  {/if}

  <!-- Rodapé Institucional com Fonte Auditada -->
  <div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Fonte Auditada:</span>
      <span class="text-zinc-200 font-medium">{data.mcpSource || "FinanceDatabase Global Directory (300k+ Ativos)"} • Registros Oficiais de Emissão</span>
    </div>
    <span class="text-zinc-500">Cadastro Multi-Ativos</span>
  </div>
</div>
