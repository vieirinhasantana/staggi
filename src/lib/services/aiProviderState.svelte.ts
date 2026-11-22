import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, EnforcementLevel, AIModelOption } from "$lib/types";
export type { AIProvider, EnforcementLevel, AIModelOption };

export interface DiscoveredModelPayload {
  id: string;
  name: string;
  description: string;
  context_window?: string;
  supports_tools: boolean;
  supports_reasoning: boolean;
  is_recommended?: boolean;
}

export const AI_MODELS: Record<AIProvider, AIModelOption[]> = {
  gemini: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash (Recommended)",
      provider: "gemini",
      description: "Flagship • High Speed, Native Tool Calling & Search Grounding",
      supportsTools: true,
      supportsReasoning: false,
      isRecommended: true,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-2.0-flash-lite",
      name: "Gemini 2.0 Flash-Lite",
      provider: "gemini",
      description: "Lightweight & Fast • Minimal Latency & High Cost Efficiency",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-2.0-pro-exp-02-05",
      name: "Gemini 2.0 Pro Experimental",
      provider: "gemini",
      description: "Highest Cognitive Capacity • Excellent for quant, code, and finance",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "2M tokens"
    },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Flash Thinking",
      provider: "gemini",
      description: "Deep Reasoning • Transparent step-by-step chain-of-thought",
      supportsTools: false,
      supportsReasoning: true,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini",
      description: "Long-Form Analysis • Massive 2M Tokens context window",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "2M tokens"
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      provider: "gemini",
      description: "Fast & Balanced • Proven reliability across financial prompts",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-1.5-flash-8b",
      name: "Gemini 1.5 Flash-8B",
      provider: "gemini",
      description: "Ultra Compact • Built for high-frequency telemetry",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    }
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o (Recommended)",
      provider: "openai",
      description: "Flagship • Intelligent, fast, multimodal flagship",
      supportsTools: true,
      supportsReasoning: false,
      isRecommended: true,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      description: "Fast & Economical • Ideal for telemetry and repetitive tasks",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "o3-mini",
      name: "o3-mini (Reasoning)",
      provider: "openai",
      description: "Quantitative & Logic • Native reasoning effort parameter",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "200k tokens"
    },
    {
      id: "o1",
      name: "o1 (Full Reasoning)",
      provider: "openai",
      description: "Max Reasoning • Deep analytical problem solving",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "200k tokens"
    },
    {
      id: "o1-mini",
      name: "o1-mini",
      provider: "openai",
      description: "Fast Reasoning • Code and mathematical modeling",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4.5-preview",
      name: "GPT-4.5 Preview (Orion)",
      provider: "openai",
      description: "Next-Gen Frontier • Encyclopedic knowledge & deep context",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "chatgpt-4o-latest",
      name: "ChatGPT-4o Latest",
      provider: "openai",
      description: "Continuous Dynamic Model • Always points to latest 4o version",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "openai",
      description: "Structured Data • Native JSON mode and multiple tool support",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    }
  ],
  anthropic: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet (Hybrid)",
      provider: "anthropic",
      description: "Recommended • State-of-the-art hybrid model with Extended Thinking",
      supportsTools: true,
      supportsReasoning: true,
      isRecommended: true,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      description: "Global Benchmark for Financial Analysis, Reasoning & MCPs",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      provider: "anthropic",
      description: "Ultra Fast • Immediate responses with high intelligence",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-opus-latest",
      name: "Claude 3 Opus",
      provider: "anthropic",
      description: "Institutional Depth • Strategic multi-tier advisory analysis",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-sonnet-20240229",
      name: "Claude 3 Sonnet",
      provider: "anthropic",
      description: "Balanced traditional Claude 3 generation model",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku",
      provider: "anthropic",
      description: "Compact traditional Claude 3 generation model",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    }
  ]
};

export const TOOL_SUPPORTED_MODELS = AI_MODELS;

const PROVIDER_STORAGE = "staggi_ai_provider";
const GEMINI_KEY_STORAGE = "staggi_gemini_api_key";
const OPENAI_KEY_STORAGE = "staggi_openai_api_key";
const ANTHROPIC_KEY_STORAGE = "staggi_anthropic_api_key";

const GEMINI_MODEL_STORAGE = "staggi_gemini_model";
const OPENAI_MODEL_STORAGE = "staggi_openai_model";
const ANTHROPIC_MODEL_STORAGE = "staggi_anthropic_model";
const ENFORCEMENT_STORAGE = "staggi_enforcement_level";

const GEMINI_VALIDATED_STORAGE = "staggi_gemini_validated";
const OPENAI_VALIDATED_STORAGE = "staggi_openai_validated";
const ANTHROPIC_VALIDATED_STORAGE = "staggi_anthropic_validated";

const DYNAMIC_MODELS_STORAGE_PREFIX = "staggi_dynamic_models_";

function getStorage(key: string, fallback: string = ""): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function setStorage(key: string, value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

function loadCachedDiscoveredModels(p: AIProvider): AIModelOption[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${DYNAMIC_MODELS_STORAGE_PREFIX}${p}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

export class AIProviderStore {
  provider = $state<AIProvider>(
    (getStorage(PROVIDER_STORAGE, "gemini") as AIProvider) || "gemini"
  );

  geminiApiKey = $state<string>(getStorage(GEMINI_KEY_STORAGE, ""));
  openaiApiKey = $state<string>(getStorage(OPENAI_KEY_STORAGE, ""));
  anthropicApiKey = $state<string>(getStorage(ANTHROPIC_KEY_STORAGE, ""));

  geminiModel = $state<string>(getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash"));
  openaiModel = $state<string>(getStorage(OPENAI_MODEL_STORAGE, "gpt-4o"));
  anthropicModel = $state<string>(getStorage(ANTHROPIC_MODEL_STORAGE, "claude-3-7-sonnet-latest"));

  enforcementLevel = $state<EnforcementLevel>(
    (getStorage(ENFORCEMENT_STORAGE, "medium") as EnforcementLevel) || "medium"
  );

  geminiValidated = $state<boolean>(
    getStorage(GEMINI_VALIDATED_STORAGE, "false") === "true" || !!getStorage(GEMINI_KEY_STORAGE, "")
  );
  openaiValidated = $state<boolean>(
    getStorage(OPENAI_VALIDATED_STORAGE, "false") === "true" || !!getStorage(OPENAI_KEY_STORAGE, "")
  );
  anthropicValidated = $state<boolean>(
    getStorage(ANTHROPIC_VALIDATED_STORAGE, "false") === "true" || !!getStorage(ANTHROPIC_KEY_STORAGE, "")
  );

  discoveredModels = $state<Record<AIProvider, AIModelOption[]>>({
    gemini: loadCachedDiscoveredModels("gemini"),
    openai: loadCachedDiscoveredModels("openai"),
    anthropic: loadCachedDiscoveredModels("anthropic"),
  });

  isFetchingModels = $state<boolean>(false);

  apiKey = $derived.by(() => {
    switch (this.provider) {
      case "openai": return this.openaiApiKey;
      case "anthropic": return this.anthropicApiKey;
      default: return this.geminiApiKey;
    }
  });

  model = $derived.by(() => {
    switch (this.provider) {
      case "openai": return this.openaiModel;
      case "anthropic": return this.anthropicModel;
      default: return this.geminiModel;
    }
  });

  isConfigured = $derived(!!this.apiKey.trim());

  isValidated = $derived.by(() => {
    switch (this.provider) {
      case "openai": return !!this.openaiApiKey.trim() && this.openaiValidated;
      case "anthropic": return !!this.anthropicApiKey.trim() && this.anthropicValidated;
      default: return !!this.geminiApiKey.trim() && this.geminiValidated;
    }
  });

  canSelectModel = $derived(true);

  availableModelOptions = $derived.by(() => {
    const staticList = AI_MODELS[this.provider] || [];
    const liveList = this.discoveredModels[this.provider] || [];

    const map = new Map<string, AIModelOption>();
    for (const m of staticList) {
      map.set(m.id, m);
    }
    for (const m of liveList) {
      const existing = map.get(m.id);
      if (existing) {
        map.set(m.id, { ...existing, ...m });
      } else {
        map.set(m.id, m);
      }
    }

    if (this.model && !map.has(this.model)) {
      map.set(this.model, {
        id: this.model,
        name: `${this.model} (Custom)`,
        provider: this.provider,
        description: "Manually specified model identifier",
        supportsTools: true,
        contextWindow: "Variable",
      });
    }

    return Array.from(map.values());
  });

  availableModels = $derived.by(() => {
    return this.availableModelOptions.map(m => m.id);
  });

  currentModelInfo = $derived.by(() => {
    const list = this.availableModelOptions;
    const found = list.find(m => m.id === this.model);
    return found || list[0];
  });

  readonly enableSearch = true;

  setProvider(p: AIProvider) {
    this.provider = p;
    setStorage(PROVIDER_STORAGE, p);
    const list = this.availableModelOptions;
    const currentForProvider = p === "openai" ? this.openaiModel : p === "anthropic" ? this.anthropicModel : this.geminiModel;
    if (!currentForProvider || !list.some(m => m.id === currentForProvider)) {
      const fallback = list.find(m => m.isRecommended) || list[0];
      if (fallback) {
        this.setModel(fallback.id);
      }
    }
  }

  setValidated(p: AIProvider, val: boolean) {
    if (p === "gemini") {
      this.geminiValidated = val;
      setStorage(GEMINI_VALIDATED_STORAGE, val ? "true" : "false");
    } else if (p === "openai") {
      this.openaiValidated = val;
      setStorage(OPENAI_VALIDATED_STORAGE, val ? "true" : "false");
    } else if (p === "anthropic") {
      this.anthropicValidated = val;
      setStorage(ANTHROPIC_VALIDATED_STORAGE, val ? "true" : "false");
    }
  }

  setApiKeyForProvider(p: AIProvider, key: string) {
    const clean = key.trim();
    if (p === "gemini") {
      if (this.geminiApiKey !== clean) {
        this.geminiValidated = false;
        setStorage(GEMINI_VALIDATED_STORAGE, "false");
      }
      this.geminiApiKey = clean;
      setStorage(GEMINI_KEY_STORAGE, clean);
    } else if (p === "openai") {
      if (this.openaiApiKey !== clean) {
        this.openaiValidated = false;
        setStorage(OPENAI_VALIDATED_STORAGE, "false");
      }
      this.openaiApiKey = clean;
      setStorage(OPENAI_KEY_STORAGE, clean);
    } else if (p === "anthropic") {
      if (this.anthropicApiKey !== clean) {
        this.anthropicValidated = false;
        setStorage(ANTHROPIC_VALIDATED_STORAGE, "false");
      }
      this.anthropicApiKey = clean;
      setStorage(ANTHROPIC_KEY_STORAGE, clean);
    }
  }

  setApiKey(key: string) {
    this.setApiKeyForProvider(this.provider, key);
  }

  setModelForProvider(p: AIProvider, modelId: string) {
    const clean = modelId.trim();
    if (!clean) return;
    if (p === "gemini") {
      this.geminiModel = clean;
      setStorage(GEMINI_MODEL_STORAGE, clean);
    } else if (p === "openai") {
      this.openaiModel = clean;
      setStorage(OPENAI_MODEL_STORAGE, clean);
    } else if (p === "anthropic") {
      this.anthropicModel = clean;
      setStorage(ANTHROPIC_MODEL_STORAGE, clean);
    }
  }

  setModel(newModel: string) {
    this.setModelForProvider(this.provider, newModel);
  }

  setEnforcementLevel(level: EnforcementLevel) {
    this.enforcementLevel = level;
    setStorage(ENFORCEMENT_STORAGE, level);
  }

  async fetchLiveModels(targetProvider?: AIProvider): Promise<AIModelOption[]> {
    const prov = targetProvider || this.provider;
    const key = prov === "openai" ? this.openaiApiKey : prov === "anthropic" ? this.anthropicApiKey : this.geminiApiKey;
    if (!key.trim()) {
      return AI_MODELS[prov] || [];
    }

    this.isFetchingModels = true;
    try {
      const result = await invoke<DiscoveredModelPayload[]>("list_ai_models", {
        provider: prov,
        apiKey: key.trim(),
      });

      if (Array.isArray(result) && result.length > 0) {
        const mapped: AIModelOption[] = result.map(m => ({
          id: m.id,
          name: m.name,
          provider: prov,
          description: m.description || "Provider language model",
          supportsTools: m.supports_tools,
          supportsReasoning: m.supports_reasoning,
          isRecommended: m.is_recommended,
          contextWindow: m.context_window || "128k tokens",
        }));

        this.discoveredModels[prov] = mapped;
        setStorage(`${DYNAMIC_MODELS_STORAGE_PREFIX}${prov}`, JSON.stringify(mapped));
        return mapped;
      }
    } catch {
      // Fallback to static catalog if network request fails
    } finally {
      this.isFetchingModels = false;
    }

    return AI_MODELS[prov] || [];
  }

  save() {
    setStorage(PROVIDER_STORAGE, this.provider);
    setStorage(GEMINI_KEY_STORAGE, this.geminiApiKey);
    setStorage(OPENAI_KEY_STORAGE, this.openaiApiKey);
    setStorage(ANTHROPIC_KEY_STORAGE, this.anthropicApiKey);
    setStorage(GEMINI_MODEL_STORAGE, this.geminiModel);
    setStorage(OPENAI_MODEL_STORAGE, this.openaiModel);
    setStorage(ANTHROPIC_MODEL_STORAGE, this.anthropicModel);
    setStorage(ENFORCEMENT_STORAGE, this.enforcementLevel);
    setStorage(GEMINI_VALIDATED_STORAGE, this.geminiValidated ? "true" : "false");
    setStorage(OPENAI_VALIDATED_STORAGE, this.openaiValidated ? "true" : "false");
    setStorage(ANTHROPIC_VALIDATED_STORAGE, this.anthropicValidated ? "true" : "false");
  }

  reloadFromStorage() {
    this.provider = (getStorage(PROVIDER_STORAGE, "gemini") as AIProvider) || "gemini";
    this.geminiApiKey = getStorage(GEMINI_KEY_STORAGE, "");
    this.openaiApiKey = getStorage(OPENAI_KEY_STORAGE, "");
    this.anthropicApiKey = getStorage(ANTHROPIC_KEY_STORAGE, "");
    this.geminiModel = getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash");
    this.openaiModel = getStorage(OPENAI_MODEL_STORAGE, "gpt-4o");
    this.anthropicModel = getStorage(ANTHROPIC_MODEL_STORAGE, "claude-3-7-sonnet-latest");
    this.enforcementLevel = (getStorage(ENFORCEMENT_STORAGE, "medium") as EnforcementLevel) || "medium";
    this.geminiValidated = getStorage(GEMINI_VALIDATED_STORAGE, "false") === "true" || !!this.geminiApiKey;
    this.openaiValidated = getStorage(OPENAI_VALIDATED_STORAGE, "false") === "true" || !!this.openaiApiKey;
    this.anthropicValidated = getStorage(ANTHROPIC_VALIDATED_STORAGE, "false") === "true" || !!this.anthropicApiKey;
  }
}

export const aiStore = new AIProviderStore();
export const geminiStore = aiStore;
