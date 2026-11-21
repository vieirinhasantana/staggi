<script lang="ts">
  import type { ParsedComparisonTable } from "$lib/services/formatMessage";
  import { 
    ArrowLeftRight, 
    Sparkles, 
    Layers, 
    Check, 
    TrendingUp, 
    AlertTriangle,
    BarChart3,
    ShieldCheck
  } from "@lucide/svelte";

  interface Props {
    data: ParsedComparisonTable;
  }

  let { data }: Props = $props();

  function getRecommendationBadge(val: string) {
    const v = val.toLowerCase();
    if (v.includes("compra") || v.includes("outperform") || v.includes("overweight")) {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    }
    if (v.includes("neutro") || v.includes("manutenção") || v.includes("hold")) {
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
    if (v.includes("venda") || v.includes("underperform")) {
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    }
    return null;
  }

  function isNumericOrCurrency(val: string) {
    return /^(?:US\$|R\$|€)\s*[\d,.]+|\b\d+(?:,\d+)?%|\b\d+(?:,\d+)?\b/.test(val.trim());
  }

  function getMetricIconColor(metric: string) {
    const m = metric.toLowerCase();
    if (m.includes("valuation") || m.includes("cotação") || m.includes("preço")) {
      return "text-emerald-400";
    }
    if (m.includes("p/l") || m.includes("yield") || m.includes("dy") || m.includes("retorno")) {
      return "text-amber-400";
    }
    if (m.includes("risco") || m.includes("alavancagem")) {
      return "text-rose-400";
    }
    if (m.includes("recomend")) {
      return "text-sky-400";
    }
    return "text-violet-400";
  }
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-3.5 select-text">
  <div class="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400">
        <ArrowLeftRight class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">Quadro Comparativo & Benchmarking</span>
          <span class="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 font-mono text-[11px] font-bold border border-violet-500/30">
            {data.headers.length - 1} Ativos
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">
          Comparação estruturada de modelos de negócio, valuation e projeções
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-zinc-400">
      <Layers class="w-3 h-3 text-violet-400" />
      <span>Multiativos</span>
    </div>
  </div>

  <div class="relative w-full rounded-xl border border-white/[0.08] bg-[#171524]/70 overflow-x-auto shadow-inner">
    <table class="w-full border-collapse text-left text-xs font-mono">
      <thead>
        <tr class="bg-white/[0.06] border-b border-white/[0.08]">
          {#each data.headers as header, colIdx}
            <th class="p-3 font-semibold text-zinc-200 {colIdx === 0 ? 'sticky left-0 bg-[#211f32] z-20 min-w-[160px] border-r border-white/[0.08]' : 'min-w-[220px]'}">
              {#if colIdx === 0}
                <span class="text-zinc-400 uppercase tracking-wider text-[10px]">{header}</span>
              {:else}
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-violet-400"></span>
                  <span class="text-zinc-100 text-xs font-bold">{header}</span>
                </div>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="divide-y divide-white/[0.04]">
        {#each data.rows as row}
          <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="p-3 font-semibold text-zinc-100 sticky left-0 bg-[#1c1a2b] z-10 border-r border-white/[0.08] text-xs">
              <div class="flex items-center gap-1.5">
                <span class={getMetricIconColor(row.metric)}>•</span>
                <span>{row.metric}</span>
              </div>
            </td>

            {#each row.values as val}
              {@const recBadge = getRecommendationBadge(val)}
              <td class="p-3 text-zinc-300 align-top leading-relaxed text-xs">
                {#if recBadge}
                  <div class="space-y-1">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold border {recBadge}">
                      <Check class="w-3 h-3" />
                      {val.split("-")[0]?.trim() || val}
                    </span>
                    {#if val.includes("-")}
                      <div class="text-[11px] text-zinc-400 font-sans mt-0.5">
                        {val.substring(val.indexOf("-") + 1).trim()}
                      </div>
                    {/if}
                  </div>
                {:else if val === "N/D" || val === "N/A"}
                  <span class="text-zinc-500 font-mono text-[11px]">N/D</span>
                {:else if isNumericOrCurrency(val) && val.length < 50}
                  <span class="font-bold text-zinc-100 font-mono text-xs bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.06]">
                    {val}
                  </span>
                {:else}
                  <span class="font-sans text-xs text-zinc-200 leading-normal">{val}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400 flex-wrap gap-2">
    <div class="flex items-center gap-1.5">
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span class="text-zinc-400">Fonte Auditada:</span>
      <span class="text-zinc-200 font-medium">B3 • SEC EDGAR • Consenso de Mercado & Relatórios de RI</span>
    </div>
    <span class="text-zinc-500">Benchmarking Multi-Ativos</span>
  </div>
</div>
