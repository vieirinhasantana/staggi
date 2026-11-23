import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, EnforcementLevel, AIModelOption } from "$lib/types";
export type { AIProvider, EnforcementLevel, AIModelOption };

export interface AIModelPayload {
  id: string;
  name: string;
  description?: string;
}

export const AI_MODELS: Record<AIProvider, AIModelOption[]> = {
  gemini: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      provider: "gemini"
    }
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai"
    }
  ],
  anthropic: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet",
      provider: "anthropic"
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

function loadCachedModels(p: AIProvider): AIModelOption[] {
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
    gemini: loadCachedModels("gemini"),
    openai: loadCachedModels("openai"),
    anthropic: loadCachedModels("anthropic"),
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
    const liveList = this.discoveredModels[this.provider] || [];
    if (liveList.length > 0) {
      return liveList;
    }
    return AI_MODELS[this.provider] || [];
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

  ensureValidActiveModel() {
    const list = this.availableModelOptions;
    if (list.length === 0) return;
    const current = this.model;
    if (!list.some(m => m.id === current)) {
      const fallback = list[0];
      if (fallback) {
        this.setModel(fallback.id);
      }
    }
  }

  setProvider(p: AIProvider) {
    this.provider = p;
    setStorage(PROVIDER_STORAGE, p);
    this.ensureValidActiveModel();
    const key = p === "openai" ? this.openaiApiKey : p === "anthropic" ? this.anthropicApiKey : this.geminiApiKey;
    if (key.trim()) {
      this.fetchLiveModels(p);
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

    if (clean.length > 15) {
      this.fetchLiveModels(p);
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
      const result = await invoke<AIModelPayload[]>("list_ai_models", {
        provider: prov,
        apiKey: key.trim(),
      });

      if (Array.isArray(result) && result.length > 0) {
        const mapped: AIModelOption[] = result.map(m => ({
          id: m.id,
          name: m.name,
          provider: prov,
          description: m.description,
        }));

        this.discoveredModels[prov] = mapped;
        setStorage(`${DYNAMIC_MODELS_STORAGE_PREFIX}${prov}`, JSON.stringify(mapped));
        this.ensureValidActiveModel();
        return mapped;
      }
    } catch {
      // Return existing discovered or default models
    } finally {
      this.isFetchingModels = false;
    }

    return this.discoveredModels[prov] || AI_MODELS[prov] || [];
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
