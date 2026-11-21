<script lang="ts">
  import type { ParsedCorporateEvents, CorporateEventItem } from "$lib/services/formatMessage";
  import { 
    Megaphone, 
    Server, 
    Calendar, 
    Coins, 
    Scale, 
    Sparkles, 
    TrendingUp, 
    BarChart3, 
    Sliders, 
    Briefcase,
    Info,
    CheckCircle2,
    ShieldCheck
  } from "@lucide/svelte";

  interface Props {
    eventsData: ParsedCorporateEvents;
  }

  let { eventsData }: Props = $props();

  function getCategoryBadge(category: CorporateEventItem["category"]) {
    switch (category) {
      case "Resultados":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "Tecnologia & IA":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "Estratégia":
        return "bg-violet-500/15 text-violet-300 border-violet-500/30";
      case "Operacional":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "Preços":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "Proventos":
        return "bg-teal-500/15 text-teal-300 border-teal-500/30";
      default:
        return "bg-white/[0.06] text-zinc-300 border-white/[0.08]";
    }
  }

  function getDetailIcon(label: string) {
    const lower = label.toLowerCase();
    if (lower.includes("data") || lower.includes("pagamento") || lower.includes("prazo")) {
      return Calendar;
    }
    if (lower.includes("valor") || lower.includes("dividendo") || lower.includes("jcp")) {
      return Coins;
    }
    if (lower.includes("tribut") || lower.includes("ir") || lower.includes("imposto")) {
      return Scale;
    }
    if (lower.includes("destaque") || lower.includes("crescimento")) {
      return TrendingUp;
    }
    return CheckCircle2;
  }
</script>

<div class="w-full rounded-2xl border border-white/[0.12] bg-[#1d1b2a]/95 backdrop-blur-2xl shadow-xl p-4.5 space-y-3.5 select-text">
  <div class="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
    <div class="flex items-center gap-2.5">
      <div class="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold text-xs font-mono">
        <Megaphone class="w-4 h-4" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-zinc-100">{eventsData.companyName || 'Radar Corporativo'}</span>
          <span class="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
            {eventsData.ticker}
          </span>
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">Fatos Relevantes & Notícias de Mercado</div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono font-semibold">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
      <span>Fonte: Fatos Relevantes CVM / SEC (Yahoo Finance)</span>
    </div>
  </div>

  <div class="rounded-xl bg-[#171524]/70 border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
    {#each eventsData.events as item}
      <div class="p-3.5 space-y-2 hover:bg-white/[0.02] transition-colors">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.08] text-zinc-200 font-mono text-xs font-bold border border-white/[0.06] shrink-0">
              {item.number}
            </span>
            <span class="font-semibold text-xs text-zinc-100">{item.title}</span>
          </div>

          <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border {getCategoryBadge(item.category)}">
            {item.category}
          </span>
        </div>

        <p class="text-xs text-zinc-200 leading-relaxed font-sans pl-7">
          {item.description}
        </p>

        {#if item.details.length > 0}
          <div class="flex items-center gap-2 flex-wrap pl-7 pt-1">
            {#each item.details as detail}
              {@const IconComp = getDetailIcon(detail.label)}
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono">
                <IconComp class="w-3 h-3 text-amber-400/90 shrink-0" />
                <span class="text-zinc-400">{detail.label}:</span>
                <span class="text-zinc-100 font-medium">{detail.value}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if eventsData.footer}
    <div class="p-3 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 flex items-start gap-2.5 text-xs text-zinc-300">
      <Info class="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
      <span class="font-sans leading-relaxed">{eventsData.footer}</span>
    </div>
  {/if}
</div>
