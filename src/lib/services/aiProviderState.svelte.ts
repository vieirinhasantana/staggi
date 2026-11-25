import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, EnforcementLevel, AIModelOption } from "$lib/types/domain/ai";

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
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini"
    }
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai"
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai"
    }
  ],
  anthropic: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet",
      provider: "anthropic"
    }
  ],
  bedrock: [
    {
      id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      name: "Claude 3.5 Sonnet v2 (Bedrock)",
      provider: "bedrock",
      description: "Anthropic Claude 3.5 Sonnet v2 on Amazon Bedrock"
    },
    {
      id: "anthropic.claude-3-5-haiku-20241022-v1:0",
      name: "Claude 3.5 Haiku (Bedrock)",
      provider: "bedrock",
      description: "High-speed, cost-effective reasoning"
    },
    {
      id: "meta.llama3-3-70b-instruct-v1:0",
      name: "Llama 3.3 70B (Bedrock)",
      provider: "bedrock",
      description: "Meta Llama 3.3 70B on Amazon Bedrock"
    },
    {
      id: "amazon.nova-pro-v1:0",
      name: "Amazon Nova Pro",
      provider: "bedrock",
      description: "High-capability multimodal model by AWS"
    },
    {
      id: "amazon.nova-lite-v1:0",
      name: "Amazon Nova Lite",
      provider: "bedrock",
      description: "Fast, ultra-affordable multimodal model by AWS"
    }
  ]
};

export const TOOL_SUPPORTED_MODELS = AI_MODELS;

const PROVIDER_STORAGE = "staggi_ai_provider";
const GEMINI_KEY_STORAGE = "staggi_gemini_api_key";
const OPENAI_KEY_STORAGE = "staggi_openai_api_key";
const ANTHROPIC_KEY_STORAGE = "staggi_anthropic_api_key";

const BEDROCK_ACCESS_KEY_STORAGE = "staggi_bedrock_access_key";
const BEDROCK_SECRET_KEY_STORAGE = "staggi_bedrock_secret_key";
const BEDROCK_REGION_STORAGE = "staggi_bedrock_region";
const BEDROCK_SESSION_TOKEN_STORAGE = "staggi_bedrock_session_token";

const GEMINI_MODEL_STORAGE = "staggi_gemini_model";
const OPENAI_MODEL_STORAGE = "staggi_openai_model";
const ANTHROPIC_MODEL_STORAGE = "staggi_anthropic_model";
const BEDROCK_MODEL_STORAGE = "staggi_bedrock_model";
const ENFORCEMENT_STORAGE = "staggi_enforcement_level";

const GEMINI_VALIDATED_STORAGE = "staggi_gemini_validated";
const OPENAI_VALIDATED_STORAGE = "staggi_openai_validated";
const ANTHROPIC_VALIDATED_STORAGE = "staggi_anthropic_validated";
const BEDROCK_VALIDATED_STORAGE = "staggi_bedrock_validated";

const DYNAMIC_MODELS_STORAGE_PREFIX = "staggi_dynamic_models_";

function getStorage(key: string, fallback: string = ""): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function setStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function loadCachedModels(provider: AIProvider): AIModelOption[] {
  if (typeof window === "undefined") return AI_MODELS[provider] || [];
  try {
    const raw = localStorage.getItem(`${DYNAMIC_MODELS_STORAGE_PREFIX}${provider}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to static
  }
  return AI_MODELS[provider] || [];
}

export class AIProviderStore {
  provider = $state<AIProvider>(
    (getStorage(PROVIDER_STORAGE, "gemini") as AIProvider) || "gemini"
  );

  geminiApiKey = $state<string>(getStorage(GEMINI_KEY_STORAGE, ""));
  openaiApiKey = $state<string>(getStorage(OPENAI_KEY_STORAGE, ""));
  anthropicApiKey = $state<string>(getStorage(ANTHROPIC_KEY_STORAGE, ""));

  // Amazon Bedrock AWS Credentials
  bedrockAccessKeyId = $state<string>(getStorage(BEDROCK_ACCESS_KEY_STORAGE, ""));
  bedrockSecretAccessKey = $state<string>(getStorage(BEDROCK_SECRET_KEY_STORAGE, ""));
  bedrockRegion = $state<string>(getStorage(BEDROCK_REGION_STORAGE, "us-east-1"));
  bedrockSessionToken = $state<string>(getStorage(BEDROCK_SESSION_TOKEN_STORAGE, ""));

  geminiModel = $state<string>(getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash"));
  openaiModel = $state<string>(getStorage(OPENAI_MODEL_STORAGE, "gpt-4o"));
  anthropicModel = $state<string>(getStorage(ANTHROPIC_MODEL_STORAGE, "claude-3-7-sonnet-latest"));
  bedrockModel = $state<string>(getStorage(BEDROCK_MODEL_STORAGE, "anthropic.claude-3-5-sonnet-20241022-v2:0"));

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
  bedrockValidated = $state<boolean>(
    getStorage(BEDROCK_VALIDATED_STORAGE, "false") === "true"
  );

  discoveredModels = $state<Record<AIProvider, AIModelOption[]>>({
    gemini: loadCachedModels("gemini"),
    openai: loadCachedModels("openai"),
    anthropic: loadCachedModels("anthropic"),
    bedrock: loadCachedModels("bedrock"),
  });

  isFetchingModels = $state<boolean>(false);

  packedBedrockCredentials = $derived.by(() => {
    if (!this.bedrockAccessKeyId.trim() || !this.bedrockSecretAccessKey.trim()) return "";
    return JSON.stringify({
      accessKeyId: this.bedrockAccessKeyId.trim(),
      secretAccessKey: this.bedrockSecretAccessKey.trim(),
      region: this.bedrockRegion.trim() || "us-east-1",
      sessionToken: this.bedrockSessionToken.trim() || undefined,
    });
  });

  apiKey = $derived.by(() => {
    switch (this.provider) {
      case "openai": return this.openaiApiKey;
      case "anthropic": return this.anthropicApiKey;
      case "bedrock": return this.packedBedrockCredentials;
      default: return this.geminiApiKey;
    }
  });

  model = $derived.by(() => {
    switch (this.provider) {
      case "openai": return this.openaiModel;
      case "anthropic": return this.anthropicModel;
      case "bedrock": return this.bedrockModel;
      default: return this.geminiModel;
    }
  });

  isConfigured = $derived.by(() => {
    if (this.provider === "bedrock") {
      return !!this.bedrockAccessKeyId.trim() && !!this.bedrockSecretAccessKey.trim();
    }
    return !!this.apiKey.trim();
  });

  isValidated = $derived.by(() => {
    switch (this.provider) {
      case "openai": return !!this.openaiApiKey.trim() && this.openaiValidated;
      case "anthropic": return !!this.anthropicApiKey.trim() && this.anthropicValidated;
      case "bedrock": return this.isConfigured && this.bedrockValidated;
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
    if (p === "bedrock") {
      if (this.isConfigured) {
        this.fetchLiveModels("bedrock");
      }
    } else {
      const key = p === "openai" ? this.openaiApiKey : p === "anthropic" ? this.anthropicApiKey : this.geminiApiKey;
      if (key.trim()) {
        this.fetchLiveModels(p);
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
    } else if (p === "bedrock") {
      this.bedrockValidated = val;
      setStorage(BEDROCK_VALIDATED_STORAGE, val ? "true" : "false");
    }
  }

  setBedrockCredentials(accessKeyId: string, secretAccessKey: string, region: string = "us-east-1", sessionToken: string = "") {
    this.bedrockAccessKeyId = accessKeyId.trim();
    this.bedrockSecretAccessKey = secretAccessKey.trim();
    this.bedrockRegion = region.trim() || "us-east-1";
    this.bedrockSessionToken = sessionToken.trim();

    setStorage(BEDROCK_ACCESS_KEY_STORAGE, this.bedrockAccessKeyId);
    setStorage(BEDROCK_SECRET_KEY_STORAGE, this.bedrockSecretAccessKey);
    setStorage(BEDROCK_REGION_STORAGE, this.bedrockRegion);
    setStorage(BEDROCK_SESSION_TOKEN_STORAGE, this.bedrockSessionToken);

    this.bedrockValidated = false;
    setStorage(BEDROCK_VALIDATED_STORAGE, "false");

    if (this.bedrockAccessKeyId && this.bedrockSecretAccessKey) {
      this.fetchLiveModels("bedrock");
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
    } else if (p === "bedrock") {
      this.bedrockModel = clean;
      setStorage(BEDROCK_MODEL_STORAGE, clean);
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
    let key = "";
    if (prov === "openai") key = this.openaiApiKey;
    else if (prov === "anthropic") key = this.anthropicApiKey;
    else if (prov === "gemini") key = this.geminiApiKey;
    else if (prov === "bedrock") {
      key = this.packedBedrockCredentials;
    }

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

    setStorage(BEDROCK_ACCESS_KEY_STORAGE, this.bedrockAccessKeyId);
    setStorage(BEDROCK_SECRET_KEY_STORAGE, this.bedrockSecretAccessKey);
    setStorage(BEDROCK_REGION_STORAGE, this.bedrockRegion);
    setStorage(BEDROCK_SESSION_TOKEN_STORAGE, this.bedrockSessionToken);

    setStorage(GEMINI_MODEL_STORAGE, this.geminiModel);
    setStorage(OPENAI_MODEL_STORAGE, this.openaiModel);
    setStorage(ANTHROPIC_MODEL_STORAGE, this.anthropicModel);
    setStorage(BEDROCK_MODEL_STORAGE, this.bedrockModel);

    setStorage(ENFORCEMENT_STORAGE, this.enforcementLevel);
    setStorage(GEMINI_VALIDATED_STORAGE, this.geminiValidated ? "true" : "false");
    setStorage(OPENAI_VALIDATED_STORAGE, this.openaiValidated ? "true" : "false");
    setStorage(ANTHROPIC_VALIDATED_STORAGE, this.anthropicValidated ? "true" : "false");
    setStorage(BEDROCK_VALIDATED_STORAGE, this.bedrockValidated ? "true" : "false");
  }

  reloadFromStorage() {
    this.provider = (getStorage(PROVIDER_STORAGE, "gemini") as AIProvider) || "gemini";
    this.geminiApiKey = getStorage(GEMINI_KEY_STORAGE, "");
    this.openaiApiKey = getStorage(OPENAI_KEY_STORAGE, "");
    this.anthropicApiKey = getStorage(ANTHROPIC_KEY_STORAGE, "");

    this.bedrockAccessKeyId = getStorage(BEDROCK_ACCESS_KEY_STORAGE, "");
    this.bedrockSecretAccessKey = getStorage(BEDROCK_SECRET_KEY_STORAGE, "");
    this.bedrockRegion = getStorage(BEDROCK_REGION_STORAGE, "us-east-1");
    this.bedrockSessionToken = getStorage(BEDROCK_SESSION_TOKEN_STORAGE, "");

    this.geminiModel = getStorage(GEMINI_MODEL_STORAGE, "gemini-2.0-flash");
    this.openaiModel = getStorage(OPENAI_MODEL_STORAGE, "gpt-4o");
    this.anthropicModel = getStorage(ANTHROPIC_MODEL_STORAGE, "claude-3-7-sonnet-latest");
    this.bedrockModel = getStorage(BEDROCK_MODEL_STORAGE, "anthropic.claude-3-5-sonnet-20241022-v2:0");

    this.enforcementLevel = (getStorage(ENFORCEMENT_STORAGE, "medium") as EnforcementLevel) || "medium";
    this.geminiValidated = getStorage(GEMINI_VALIDATED_STORAGE, "false") === "true" || !!this.geminiApiKey;
    this.openaiValidated = getStorage(OPENAI_VALIDATED_STORAGE, "false") === "true" || !!this.openaiApiKey;
    this.anthropicValidated = getStorage(ANTHROPIC_VALIDATED_STORAGE, "false") === "true" || !!this.anthropicApiKey;
    this.bedrockValidated = getStorage(BEDROCK_VALIDATED_STORAGE, "false") === "true";
  }
}

export const aiStore = new AIProviderStore();
export const geminiStore = aiStore;
