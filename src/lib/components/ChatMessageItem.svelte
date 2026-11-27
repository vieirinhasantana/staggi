<script lang="ts">
  import type { ChatMessage } from "$lib/types";
  import {
    AssetQuoteCard,
    CorporateEventsCard,
    ValuationProjectionCard,
    AssetDividendsCard,
    AssetProfileCard,
    PortfolioDistributionCard
  } from "./cards";
  import { 
    parseAssetQuote, 
    parseCorporateEvents, 
    parseValuationProjection, 
    parseAssetDividends, 
    parseAssetProfile,
    parseAssetProfiles,
    parsePortfolioDistribution,
    detectAuditedSource,
    renderMarkdown 
  } from "$lib/services/formatMessage";
  import { exportReportAsPdf, sendClientEmail } from "$lib/services/pdfExportService";
  import { toastStore } from "$lib/services/toastService.svelte";
  import { 
    Bot, 
    Sparkles, 
    ShieldCheck, 
    Brain, 
    FileDown, 
    Mail, 
    Copy, 
    Check, 
    Paperclip 
  } from "@lucide/svelte";
  import { t } from "$lib/i18n";

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();

  let isCopied = $state(false);

  // Dynamic status cycling (like ChatGPT / Claude)
  let displayStatus = $state("Thinking...");
  let isFading = $state(false);

  function getAlternatingPhrases(currentText: string): string[] {
    const lower = currentText.toLowerCase();
    if (lower.includes("portfolio") || lower.includes("position")) {
      return [
        currentText,
        "Reading portfolio positions...",
        "Evaluating asset distribution...",
        "Consolidating position balances...",
        "Analyzing allocations..."
      ];
    }
    if (lower.includes("rebalance") || lower.includes("balance") || lower.includes("structur")) {
      return [
        currentText,
        "Balancing portfolio structure...",
        "Calculating target weights...",
        "Evaluating delta adjustments...",
        "Formulating allocation strategy..."
      ];
    }
    if (lower.includes("quote") || lower.includes("price") || lower.includes("market") || lower.includes("telemetry")) {
      return [
        currentText,
        "Fetching market telemetry...",
        "Querying latest price quotes...",
        "Verifying financial multiples...",
        "Auditing market data..."
      ];
    }
    if (lower.includes("filing") || lower.includes("sec") || lower.includes("report") || lower.includes("dividend")) {
      return [
        currentText,
        "Searching regulatory disclosures...",
        "Auditing dividend history...",
        "Extracting financial facts..."
      ];
    }
    if (lower.includes("synthesiz") || lower.includes("finaliz") || lower.includes("respons")) {
      return [
        currentText,
        "Synthesizing response...",
        "Formatting executive insights...",
        "Structuring fiduciary reply..."
      ];
    }
    return [
      currentText,
      "Consulting data sources...",
      "Analyzing parameters...",
      "Formulating insights...",
      "Thinking..."
    ];
  }

  $effect(() => {
    if (!message.isLoading) return;

    displayStatus = message.text || "Thinking...";
    const phrases = getAlternatingPhrases(displayStatus);
    let index = 0;

    const timer = setInterval(() => {
      index = (index + 1) % phrases.length;
      isFading = true;
      setTimeout(() => {
        displayStatus = phrases[index];
        isFading = false;
      }, 160);
    }, 2200);

    return () => clearInterval(timer);
  });

  // High-performance lazy derivation: execute expensive regex parsers only when needed
  let isParsable = $derived(message.sender === "staggi" && !message.isLoading && !message.isStreaming);

  let auditedSource = $derived(
    isParsable
      ? ((message.metadata?.source as string) || detectAuditedSource(message.text))
      : null
  );

  let assetProfiles = $derived(
    isParsable ? parseAssetProfiles(message.text) : []
  );

  let assetDividends = $derived(
    isParsable ? parseAssetDividends(message.text) : null
  );

  let valuationProjection = $derived(
    isParsable ? parseValuationProjection(message.text) : null
  );

  let assetQuote = $derived(
    isParsable ? parseAssetQuote(message.text) : null
  );

  let corporateEvents = $derived(
    isParsable ? parseCorporateEvents(message.text) : null
  );

  let portfolioDistribution = $derived(
    isParsable ? parsePortfolioDistribution(message.text) : null
  );

  const isReportRequested = $derived(
    message.metadata?.isPdfRequested === true ||
    /\[(?:download_pdf|export_pdf|pdf_ready)\]/i.test(message.text) ||
    /(?:click\s+below\s+to\s+download\s+pdf|clique\s+abaixo\s+para\s+baixar\s+o\s+pdf|pdf\s+report\s+ready\s+for\s+download)/i.test(message.text)
  );

  function handleExportPdf() {
    exportReportAsPdf({
      title: portfolioDistribution ? portfolioDistribution.title : "Fiduciary Wealth & Analysis Report",
      subtitle: portfolioDistribution
        ? (portfolioDistribution.isRebalancing
          ? "Executive Rebalancing Factsheet: Target Weights & Strategic Asset Allocation"
          : "Portfolio Asset Allocation & Class Distribution Report")
        : "Market Telemetry, Multi-Asset Intelligence & Executive Research",
      clientName: portfolioDistribution?.clientName,
      totalValue: portfolioDistribution?.totalValue,
      isRebalancing: portfolioDistribution?.isRebalancing,
      allocations: portfolioDistribution ? portfolioDistribution.items.map(it => ({
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
      })) : undefined,
      auditedSource: auditedSource || "Staggi AI Fiduciary Advisory",
      rawMarkdown: message.text,
      verdict: "Fiduciary analysis compiled according to requested risk and telemetry parameters."
    });
  }

  function handleSendEmail() {
    sendClientEmail({
      subject: "Executive Advisory Report • Staggi Wealth",
      summary: message.text
    });
  }

  function handleCopyText() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.text);
      isCopied = true;
      toastStore.showToast("Copied to clipboard!", "success");
      setTimeout(() => (isCopied = false), 2000);
    }
  }
</script>

<div class="flex flex-col gap-1.5 {message.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in">
  <div class="flex items-center gap-1.5 px-2 text-[11px] text-zinc-400">
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
    <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-white/[0.08] border border-white/[0.12] shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.08)] text-zinc-100 px-4 py-2.5 text-sm backdrop-blur-xl leading-relaxed select-text space-y-2">
      <div>{message.text}</div>
      {#if message.attachments && message.attachments.length > 0}
        <div class="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-white/[0.08]">
          {#each message.attachments as att (att.id)}
            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.1] text-[11px] text-zinc-300">
              <Paperclip class="w-3 h-3 text-emerald-400 shrink-0" />
              <span class="font-medium truncate max-w-[140px]">{att.name}</span>
              <span class="text-[9px] text-zinc-400 font-sans">({att.sizeFormatted})</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    {#if message.isLoading}
      <div class="w-full rounded-2xl border border-white/[0.08] bg-[#212121]/90 shadow-sm p-3.5 backdrop-blur-xl">
        <div class="flex items-center gap-2.5 py-0.5 text-xs text-amber-300/90 whitespace-nowrap overflow-hidden">
          <div class="relative flex items-center justify-center shrink-0 w-4 h-4">
            <span class="absolute inline-flex h-full w-full rounded-full bg-amber-400/30 animate-ping"></span>
            <Sparkles class="w-3.5 h-3.5 text-amber-400 relative z-10 animate-pulse" />
          </div>
          <span
            class="font-medium tracking-wide text-zinc-200 transition-opacity duration-200 truncate {isFading ? 'opacity-20' : 'opacity-100'}"
          >
            {displayStatus}
          </span>
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

    {:else if valuationProjection}
      <ValuationProjectionCard data={valuationProjection} />

    {:else if corporateEvents}
      <CorporateEventsCard eventsData={corporateEvents} />

    {:else if portfolioDistribution}
      <PortfolioDistributionCard data={portfolioDistribution} rawText={message.text} source={auditedSource || undefined} />

    {:else if assetQuote}
      <AssetQuoteCard quote={assetQuote} />

    {:else}
      <div class="w-full max-w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#212121]/90 shadow-sm p-4 space-y-3 select-text overflow-hidden">
        <div class="text-sm text-zinc-200 leading-relaxed font-normal space-y-2.5 break-words min-w-0 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-2 [&_li]:my-0.5 [&_li]:text-zinc-200 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-[#181818] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-2 [&_ol>li]:my-0.5 [&_ol>li]:text-zinc-200 [&_ol>li]:leading-relaxed [&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse [&_th]:bg-white/[0.08] [&_th]:p-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-zinc-200 [&_th]:border-b [&_th]:border-white/[0.1] [&_td]:p-2.5 [&_td]:text-xs [&_td]:text-zinc-300 [&_td]:border-b [&_td]:border-white/[0.04] [&_tr:hover]:bg-white/[0.03]">
          {@html renderMarkdown(message.text)}
          {#if message.isStreaming}
            <span class="inline-block w-1.5 h-3.5 bg-amber-400 ml-1 animate-pulse align-middle rounded-sm"></span>
          {/if}
        </div>

        {#if auditedSource || (!message.isLoading && !message.isStreaming && message.text.length > 20)}
          <div class="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.04] text-[10px] text-zinc-400 gap-2 flex-nowrap">
            {#if auditedSource}
              <div class="flex items-center gap-1.5 min-w-0 truncate">
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span class="text-zinc-400 shrink-0">{t("common.auditedSource")}:</span>
                <span class="text-zinc-200 font-medium truncate">{auditedSource}</span>
              </div>
            {:else}
              <div></div>
            {/if}

            <div class="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              {#if isReportRequested}
                <button
                  type="button"
                  onclick={handleExportPdf}
                  title="Download PDF Report"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-medium border border-emerald-500/30 cursor-pointer transition-all active:scale-95 shadow-sm whitespace-nowrap shrink-0"
                >
                  <FileDown class="w-3 h-3 shrink-0" />
                  <span class="whitespace-nowrap">Download PDF</span>
                </button>
              {/if}

              <button
                type="button"
                onclick={handleCopyText}
                title="Copy message response"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer text-[10px] whitespace-nowrap shrink-0"
              >
                {#if isCopied}
                  <Check class="w-3 h-3 text-emerald-400 shrink-0" />
                  <span class="text-emerald-300 text-[10px] whitespace-nowrap">Copied</span>
                {:else}
                  <Copy class="w-3 h-3 shrink-0" />
                  <span class="text-[10px] whitespace-nowrap">Copy</span>
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
