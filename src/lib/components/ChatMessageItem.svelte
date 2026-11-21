<script lang="ts">
  import type { ChatMessage } from "$lib/types";
  import {
    AssetQuoteCard,
    CorporateEventsCard,
    ValuationProjectionCard,
    AssetDividendsCard,
    ComparisonTableCard,
    AssetProfileCard,
  } from "./cards";
  import { 
    parseAssetQuote, 
    parseCorporateEvents, 
    parseValuationProjection, 
    parseAssetDividends, 
    parseComparisonTable,
    parseAssetProfile,
    parseAssetProfiles,
    detectAuditedSource,
    renderMarkdown 
  } from "$lib/services/formatMessage";
  import { Bot, Sparkles, ShieldCheck, Brain } from "@lucide/svelte";
  import { t } from "$lib/i18n";

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();

  let auditedSource = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? detectAuditedSource(message.text) : null
  );

  let assetProfiles = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseAssetProfiles(message.text) : []
  );

  let assetDividends = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseAssetDividends(message.text) : null
  );

  let comparisonTable = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseComparisonTable(message.text) : null
  );

  let valuationProjection = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseValuationProjection(message.text) : null
  );

  let assetQuote = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseAssetQuote(message.text) : null
  );

  let corporateEvents = $derived(
    message.sender === "staggi" && !message.isLoading && !message.isStreaming ? parseCorporateEvents(message.text) : null
  );
</script>

<div class="flex flex-col gap-1.5 {message.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in">
  <div class="flex items-center gap-1.5 px-2 text-[11px] text-zinc-400 font-mono">
    {#if message.sender === 'user'}
      <span>{t("chat.user")}</span>
    {:else}
      <span class="flex items-center gap-1.5 text-emerald-400 font-semibold">
        <img src="/favicon.png" alt="Staggi" class="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-emerald-500/30" /> {t("chat.assistant")}
      </span>
    {/if}
    <span>• {message.time}</span>
  </div>

  {#if message.sender === 'user'}
    <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-white/[0.08] border border-white/[0.12] shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.08)] text-zinc-100 px-4 py-2.5 text-sm backdrop-blur-xl leading-relaxed select-text">
      {message.text}
    </div>
  {:else}
    {#if message.isLoading}
      <div class="w-full rounded-2xl border border-white/[0.08] bg-[#1d1b2a]/90 shadow-sm p-3.5">
        <div class="flex items-center gap-2.5 py-1 text-xs font-mono text-amber-300/90">
          <Brain class="w-4 h-4 animate-pulse text-amber-400 shrink-0" />
          <span class="animate-pulse">{message.text}</span>
        </div>
      </div>

    {:else if assetProfiles.length > 0}
      <div class="space-y-4 w-full">
        {#each assetProfiles as profile (profile.identifier || profile.name)}
          <AssetProfileCard data={profile} />
        {/each}
      </div>

    {:else if assetDividends}
      <AssetDividendsCard data={assetDividends} />

    {:else if comparisonTable}
      <ComparisonTableCard data={comparisonTable} />

    {:else if valuationProjection}
      <ValuationProjectionCard data={valuationProjection} />

    {:else if corporateEvents}
      <CorporateEventsCard eventsData={corporateEvents} />

    {:else if assetQuote}
      <AssetQuoteCard quote={assetQuote} />

    {:else}
      <div class="w-full rounded-2xl border border-white/[0.08] bg-[#1d1b2a]/90 shadow-sm p-4 space-y-3 select-text">
        <div class="text-sm text-zinc-200 leading-relaxed font-normal space-y-2.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-2 [&_li]:my-0.5 [&_li]:text-zinc-200 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#161522] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-2 [&_ol>li]:my-0.5 [&_ol>li]:text-zinc-200 [&_ol>li]:leading-relaxed [&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse [&_table]:rounded-xl [&_table]:overflow-hidden [&_th]:bg-white/[0.08] [&_th]:p-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-mono [&_th]:text-zinc-200 [&_th]:border-b [&_th]:border-white/[0.1] [&_td]:p-2.5 [&_td]:text-xs [&_td]:font-mono [&_td]:text-zinc-300 [&_td]:border-b [&_td]:border-white/[0.04] [&_tr:hover]:bg-white/[0.03]">
          {@html renderMarkdown(message.text)}
          {#if message.isStreaming}
            <span class="inline-block w-1.5 h-3.5 bg-amber-400 ml-1 animate-pulse align-middle rounded-sm"></span>
          {/if}
        </div>

        {#if auditedSource}
          <div class="flex items-center justify-between pt-2.5 mt-1 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400">
            <div class="flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span class="text-zinc-400">{t("common.auditedSource")}:</span>
              <span class="text-zinc-200 font-medium">{auditedSource}</span>
            </div>
            <span class="text-zinc-500 hidden sm:inline">Official Consensus</span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
