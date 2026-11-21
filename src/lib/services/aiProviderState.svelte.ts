import type { AIProvider, EnforcementLevel, AIModelOption } from "$lib/types";
export type { AIProvider, EnforcementLevel, AIModelOption };

export const AI_MODELS: Record<AIProvider, AIModelOption[]> = {
  gemini: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash (Flagship)",
      provider: "gemini",
      description: "Recomendado • Ultra Rápido, Function Calling nativo e Google Search Grounding",
      supportsTools: true,
      supportsReasoning: false,
      isRecommended: true,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Flash Thinking (Exp)",
      provider: "gemini",
      description: "Raciocínio Profundo • Pensamento passo a passo com raciocínio transparente",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-2.0-pro-exp-02-05",
      name: "Gemini 2.0 Pro (Experimental)",
      provider: "gemini",
      description: "Alta Capacidade Cognitiva • Excelente para matemática, quant e finanças",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "2M tokens"
    },
    {
      id: "gemini-2.0-flash-lite",
      name: "Gemini 2.0 Flash-Lite",
      provider: "gemini",
      description: "Leve e Econômico • Menor latência e eficiência máxima de custos",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini",
      description: "Análise Extensa • Janela massiva de 2M Tokens",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "2M tokens"
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      provider: "gemini",
      description: "Versátil & Rápido • Equilíbrio consagrado de custo e velocidade",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    },
    {
      id: "gemini-1.5-flash-8b",
      name: "Gemini 1.5 Flash-8B",
      provider: "gemini",
      description: "Ultra Compacto • Otimizado para alta frequência",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "1M tokens"
    }
  ],
  openai: [
    {
      id: "gpt-4.5-preview",
      name: "GPT-4.5 Preview (Orion)",
      provider: "openai",
      description: "Modelo Gigante • Conhecimento enciclopédico e inteligência contextual",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4o",
      name: "GPT-4o (Omni)",
      provider: "openai",
      description: "Recomendado • Modelo principal inteligente e multimodal",
      supportsTools: true,
      supportsReasoning: false,
      isRecommended: true,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      description: "Rápido & Econômico • Ideal para tarefas frequentes e dados",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "o3-mini",
      name: "o3-mini (Reasoning)",
      provider: "openai",
      description: "Raciocínio Lógico & Quantitativo • Suporte nativo a Reasoning Effort",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "200k tokens"
    },
    {
      id: "o1",
      name: "o1 (Full Reasoning)",
      provider: "openai",
      description: "Raciocínio Máximo • Raciocínio profundo para problemas complexos",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "200k tokens"
    },
    {
      id: "o1-mini",
      name: "o1-mini",
      provider: "openai",
      description: "Raciocínio Rápido • Focado em código e matemática",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "128k tokens"
    },
    {
      id: "o1-preview",
      name: "o1-preview",
      provider: "openai",
      description: "Versão de Raciocínio Preliminar da OpenAI",
      supportsTools: true,
      supportsReasoning: true,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "openai",
      description: "Análise Densa e Estruturada • Suporte a JSON Mode e Tools",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "128k tokens"
    },
    {
      id: "gpt-4",
      name: "GPT-4 (Original)",
      provider: "openai",
      description: "Alta Confiabilidade Analítica Tradicional",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "8k tokens"
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      provider: "openai",
      description: "Legado de Alta Velocidade e Custo Mínimo",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "16k tokens"
    }
  ],
  anthropic: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet (Hybrid)",
      provider: "anthropic",
      description: "Recomendado • Estado da arte híbrido com Extended Thinking",
      supportsTools: true,
      supportsReasoning: true,
      isRecommended: true,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      description: "Referência Global para Análise Financeira, Raciocínio e MCPs",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      provider: "anthropic",
      description: "Ultra Rápido • Respostas imediatas com alta inteligência",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-opus-latest",
      name: "Claude 3 Opus",
      provider: "anthropic",
      description: "Análise Institucional Profunda e Estratégica",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-sonnet-20240229",
      name: "Claude 3 Sonnet",
      provider: "anthropic",
      description: "Equilíbrio da Geração Claude 3",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    },
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku",
      provider: "anthropic",
      description: "Velocidade Compacta da Geração Claude 3",
      supportsTools: true,
      supportsReasoning: false,
      contextWindow: "200k tokens"
    }
  ]
};

// Mantido para compatibilidade
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

function getStorage(key: string, fallback: string = ""): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function setStorage(key: string, value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

function getInitialGeminiModel(): string {
  const stored = getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash");
  if (stored.startsWith("gemini-2.5") || !AI_MODELS.gemini.some(m => m.id === stored)) {
    setStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash");
    return "gemini-2.0-flash";
  }
  return stored;
}

export class AIProviderStore {
  provider = $state<AIProvider>(
    (getStorage(PROVIDER_STORAGE, "gemini") as AIProvider) || "gemini"
  );

  geminiApiKey = $state<string>(getStorage(GEMINI_KEY_STORAGE, ""));
  openaiApiKey = $state<string>(getStorage(OPENAI_KEY_STORAGE, ""));
  anthropicApiKey = $state<string>(getStorage(ANTHROPIC_KEY_STORAGE, ""));

  geminiModel = $state<string>(getInitialGeminiModel());
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

  // Propriedades computadas para o provedor ativo
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

  // Permite selecionar e alternar livremente entre os modelos oficiais catalogados
  canSelectModel = $derived(true);

  // Lista completa de modelos disponíveis para o provedor ativo
  availableModels = $derived.by(() => {
    const list = AI_MODELS[this.provider] || [];
    return list.map(m => m.id);
  });

  currentModelInfo = $derived.by(() => {
    const list = AI_MODELS[this.provider] || [];
    const found = list.find(m => m.id === this.model);
    return found || list[0];
  });

  readonly enableSearch = true;

  setProvider(p: AIProvider) {
    this.provider = p;
    setStorage(PROVIDER_STORAGE, p);
    const list = AI_MODELS[p] || [];
    const currentForProvider = p === "openai" ? this.openaiModel : p === "anthropic" ? this.anthropicModel : this.geminiModel;
    if (!list.some(m => m.id === currentForProvider)) {
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

  setAvailableModels(_models: string[]) {
    // Modelos dinâmicos adicionais mantendo filtro estrito de tools
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
    let storedGemini = getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash");
    if (storedGemini.startsWith("gemini-2.5") || !AI_MODELS.gemini.some(m => m.id === storedGemini)) {
      storedGemini = "gemini-2.0-flash";
      setStorage(GEMINI_MODEL_STORAGE, storedGemini);
    }
    this.geminiModel = storedGemini;
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
