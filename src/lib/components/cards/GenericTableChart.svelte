<script lang="ts">
  import { BarChart3, TrendingUp, Layers, Check } from "@lucide/svelte";

  interface Props {
    rawMarkdown: string;
  }

  let { rawMarkdown }: Props = $props();

  interface ChartItem {
    label: string;
    value: number;
    formatted: string;
    color: string;
  }

  const palette = [
    "#10b981", // emerald
    "#0ea5e9", // sky
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#ec4899", // pink
    "#14b8a6", // teal
    "#6366f1", // indigo
    "#f97316", // orange
  ];

  // Parse markdown table rows
  const parsedTable = $derived.by(() => {
    const lines = rawMarkdown.split("\n").map(l => l.trim()).filter(l => l.startsWith("|") && l.endsWith("|"));
    if (lines.length < 3) return null;

    const headerLine = lines[0];
    const headers = headerLine.split("|").map(h => h.trim().replace(/\*\*/g, "")).filter(Boolean);
    if (headers.length < 2) return null;

    const dataRows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
      const row = lines[i].split("|").map(c => c.trim().replace(/\*\*/g, "")).filter(Boolean);
      if (row.length >= 2 && !row.every(c => c.includes("---"))) {
        dataRows.push(row);
      }
    }

    if (dataRows.length === 0) return null;

    // Detect numeric columns (index 1 to headers.length-1)
    const numericCols: number[] = [];
    for (let col = 1; col < headers.length; col++) {
      const hasNumbers = dataRows.some(r => {
        const val = r[col];
        return val && /[\d]+(?:[.,]\d+)?/.test(val);
      });
      if (hasNumbers) {
        numericCols.push(col);
      }
    }

    return { headers, dataRows, numericCols };
  });

  let selectedColIdx = $state<number>(1);

  // Sync selected column if table changes
  $effect(() => {
    if (parsedTable && parsedTable.numericCols.length > 0) {
      if (!parsedTable.numericCols.includes(selectedColIdx)) {
        selectedColIdx = parsedTable.numericCols[0];
      }
    }
  });

  const chartItems = $derived.by<ChartItem[]>(() => {
    if (!parsedTable || parsedTable.dataRows.length === 0) return [];
    const col = selectedColIdx;

    const items: ChartItem[] = [];
    for (let i = 0; i < parsedTable.dataRows.length; i++) {
      const row = parsedTable.dataRows[i];
      const label = row[0] || `Item ${i + 1}`;
      const rawVal = row[col] || "";
      
      const numMatch = rawVal.match(/[-+]?[\d]+(?:[.,]\d+)?/);
      const num = numMatch ? parseFloat(numMatch[0].replace(",", ".")) : 0;

      items.push({
        label,
        value: num,
        formatted: rawVal,
        color: palette[i % palette.length]
      });
    }

    return items;
  });

  const maxValue = $derived.by(() => {
    const vals = chartItems.map(i => Math.abs(i.value));
    const max = Math.max(...vals, 0.001);
    return max;
  });
</script>

{#if parsedTable && chartItems.length > 0}
  <div class="w-full rounded-xl border border-white/[0.08] bg-[#1a1a1a]/95 p-3.5 space-y-3 shadow-inner select-text">
    <!-- Header with Column Selector -->
    <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/[0.06]">
      <div class="flex items-center gap-2">
        <div class="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
          <BarChart3 class="w-3.5 h-3.5" />
        </div>
        <span class="text-xs font-semibold text-zinc-200">Visualização Gráfica da Tabela</span>
      </div>

      {#if parsedTable.numericCols.length > 1}
        <div class="flex items-center gap-1 text-[11px]">
          <span class="text-zinc-400 mr-1">Métrica:</span>
          {#each parsedTable.numericCols as col}
            <button
              type="button"
              onclick={() => (selectedColIdx = col)}
              class="px-2 py-0.5 rounded-md transition-all cursor-pointer {selectedColIdx === col
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/35'
                : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200'}"
            >
              {parsedTable.headers[col] || `Coluna ${col}`}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Horizontal Bar Charts -->
    <div class="space-y-2 pt-1">
      {#each chartItems as item}
        {@const pct = Math.min(100, Math.max(8, (Math.abs(item.value) / maxValue) * 100))}
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-zinc-300 truncate max-w-[240px]">{item.label}</span>
            <span class="font-bold text-zinc-100" style="color: {item.color}">{item.formatted}</span>
          </div>

          <div class="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              style="width: {pct}%; background-color: {item.color};"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
