import { useMemo, type Dispatch, type SetStateAction } from "react";

import {
  BrainIcon,
  DatabaseIcon,
  EyeIcon,
  ImageIcon,
  ListFilterIcon,
  Loader2Icon,
  MessageSquareIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  getApiEndpointPreview,
  getBaseUrl,
  getImageApiEndpointPreview,
  normalizeApiUrlInput,
} from "../../../../services/ai";
import { Select } from "../../../ui/Select";
import { getCategoryIcon } from "../../../ui/ModelIcons";
import { PasswordInput } from "../../shared";
import { PROVIDER_OPTIONS } from "../constants";
import { getProviderInfo } from "../helpers";
import type { ModelFormState } from "../types";

export function BaseFields({
  modelForm,
  setModelForm,
  fetchingModels,
  onFetchModels,
  lockEndpointFields = false,
}: {
  modelForm: ModelFormState;
  setModelForm: Dispatch<SetStateAction<ModelFormState>>;
  fetchingModels: boolean;
  onFetchModels?: () => void;
  lockEndpointFields?: boolean;
}) {
  const { t } = useTranslation();
  const capabilities = modelForm.capabilities ?? {
    chat: modelForm.type === "chat",
    vision: false,
    imageGeneration: modelForm.type === "image",
    reasoning: false,
    toolUse: false,
    webSearch: false,
    embedding: false,
    rerank: false,
  };
  const trimmedApiUrl = modelForm.apiUrl.trim();
  const normalizedInput = useMemo(
    () => normalizeApiUrlInput(modelForm.apiUrl),
    [modelForm.apiUrl],
  );
  const baseUrlPreview = useMemo(
    () => getBaseUrl(modelForm.apiUrl),
    [modelForm.apiUrl],
  );
  const requestPreview = useMemo(
    () =>
      modelForm.type === "image"
        ? getImageApiEndpointPreview(modelForm.apiUrl)
        : getApiEndpointPreview(modelForm.apiUrl, modelForm.apiProtocol),
    [modelForm.apiProtocol, modelForm.apiUrl, modelForm.type],
  );
  const fullEndpointDetected = Boolean(
    trimmedApiUrl &&
    !trimmedApiUrl.endsWith("#") &&
    baseUrlPreview &&
    baseUrlPreview !== trimmedApiUrl.replace(/\/$/, ""),
  );
  const providerExamples = useMemo(() => {
    if (modelForm.apiProtocol === "gemini") {
      return [
        "https://generativelanguage.googleapis.com",
        "https://generativelanguage.googleapis.com/v1beta",
      ];
    }

    if (modelForm.apiProtocol === "anthropic") {
      return ["https://api.anthropic.com", "https://api.anthropic.com/v1"];
    }

    const provider = getProviderInfo(modelForm.provider);
    return [
      provider?.defaultUrl || "https://api.openai.com",
      "https://api.example.com/v1",
    ].filter(Boolean);
  }, [modelForm.apiProtocol, modelForm.provider]);
  const providerInfo = useMemo(
    () => getProviderInfo(modelForm.provider),
    [modelForm.provider],
  );
  const showProtocolField = providerInfo?.allowsCustomProtocol === true;
  const providerOptions = PROVIDER_OPTIONS.map((item) => ({
    value: item.id,
    label: (
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="shrink-0">
          {getCategoryIcon(item.iconCategory, 18)}
        </span>
        <span className="truncate">{item.name}</span>
      </span>
    ),
    labelText: item.name,
  }));

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {t("settings.customNameOptional")}
        </label>
        <input
          type="text"
          value={modelForm.name}
          onChange={(event) =>
            setModelForm((prev) => ({ ...prev, name: event.target.value }))
          }
          aria-label={t("settings.customNameOptional")}
          placeholder={t("settings.customNamePlaceholder")}
          className="h-10 w-full rounded-lg bg-muted px-3 text-sm"
        />
      </div>

      {lockEndpointFields ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("settings.providerName")}
              </label>
              <Select
                value={modelForm.provider}
                onChange={(value) => {
                  const provider = getProviderInfo(value);
                  setModelForm((prev) => ({
                    ...prev,
                    provider: value,
                    apiProtocol:
                      provider?.recommendedProtocol || prev.apiProtocol,
                    apiUrl: provider?.defaultUrl || prev.apiUrl,
                  }));
                }}
                options={providerOptions}
              />
            </div>
            {showProtocolField ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {t("settings.protocol")}
                </label>
                <Select
                  value={modelForm.apiProtocol}
                  disabled={lockEndpointFields}
                  onChange={(value) =>
                    setModelForm((prev) => ({
                      ...prev,
                      apiProtocol: value as ModelFormState["apiProtocol"],
                    }))
                  }
                  options={[
                    {
                      value: "openai",
                      label: t("settings.protocolOpenAICompatible"),
                    },
                    {
                      value: "gemini",
                      label: t("settings.protocolGeminiCompatible"),
                    },
                    {
                      value: "anthropic",
                      label: t("settings.protocolAnthropicCompatible"),
                    },
                  ]}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("settings.apiKey")}
              </label>
              <PasswordInput
                value={modelForm.apiKey}
                disabled={lockEndpointFields}
                placeholder={t("settings.apiKeyPlaceholder")}
                onChange={(value) =>
                  setModelForm((prev) => ({ ...prev, apiKey: value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("settings.apiUrl")}
            </label>
            <input
              type="text"
              value={modelForm.apiUrl}
              disabled={lockEndpointFields}
              onChange={(event) =>
                setModelForm((prev) => ({
                  ...prev,
                  apiUrl: event.target.value,
                }))
              }
              onBlur={() =>
                setModelForm((prev) => {
                  const nextApiUrl = normalizeApiUrlInput(prev.apiUrl);
                  return nextApiUrl === prev.apiUrl
                    ? prev
                    : { ...prev, apiUrl: nextApiUrl };
                })
              }
              aria-label={t("settings.apiUrl")}
              placeholder={t("settings.apiUrlPlaceholder")}
              className="h-10 w-full rounded-lg bg-muted px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <div className="text-muted-foreground">
                {t("settings.aiWorkbenchApiUrlGuide")}
              </div>
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("settings.aiWorkbenchApiUrlExamplesLabel")}:
                </span>{" "}
                <span className="font-mono">
                  {providerExamples.join("  ·  ")}
                </span>
              </div>
              {baseUrlPreview ? (
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("settings.aiWorkbenchApiUrlBaseLabel")}:
                  </span>
                  <span className="break-all font-mono text-primary">
                    {baseUrlPreview}
                  </span>
                </div>
              ) : null}
              {requestPreview ? (
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("settings.aiWorkbenchApiUrlRequestLabel")}:
                  </span>
                  <span className="break-all font-mono text-primary">
                    {requestPreview}
                  </span>
                </div>
              ) : null}
              {trimmedApiUrl.endsWith("#") ? (
                <div className="inline-flex w-fit rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400">
                  {t("settings.autoFillDisabled")}
                </div>
              ) : null}
              {fullEndpointDetected || normalizedInput !== trimmedApiUrl ? (
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  {t("settings.aiWorkbenchApiUrlDetectedFullEndpoint")}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("settings.modelName")}</span>
          {onFetchModels ? (
            <button
              type="button"
              onClick={onFetchModels}
              disabled={fetchingModels}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {fetchingModels ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="h-3.5 w-3.5" />
              )}
              {t("settings.fetchModels")}
            </button>
          ) : null}
        </div>
        <input
          type="text"
          value={modelForm.model}
          onChange={(event) =>
            setModelForm((prev) => ({ ...prev, model: event.target.value }))
          }
          aria-label={t("settings.modelName")}
          placeholder={t("settings.modelNamePlaceholder")}
          className="h-10 w-full rounded-lg bg-muted px-3 text-sm"
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          {t("settings.aiWorkbenchModelCapabilities")}
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.chatModel")}
              checked={capabilities.chat === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  type:
                    checked || prev.capabilities.imageGeneration !== true
                      ? "chat"
                      : "image",
                  capabilities: {
                    ...prev.capabilities,
                    chat: checked,
                    vision: checked ? prev.capabilities.vision : false,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <MessageSquareIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.chatModel")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchRouteMainTextDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.imageModel")}
              checked={capabilities.imageGeneration === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  type: checked ? "image" : "chat",
                  capabilities: {
                    ...prev.capabilities,
                    imageGeneration: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.imageModel")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchRouteImageGenerationDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchVisionCapability")}
              checked={capabilities.vision === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  capabilities: {
                    ...prev.capabilities,
                    chat: true,
                    vision: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <EyeIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchVisionCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchVisionCapabilityDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchReasoningCapability")}
              checked={capabilities.reasoning === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  capabilities: {
                    ...prev.capabilities,
                    chat: true,
                    reasoning: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <BrainIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchReasoningCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchReasoningCapabilityDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchToolUseCapability")}
              checked={capabilities.toolUse === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  capabilities: {
                    ...prev.capabilities,
                    chat: true,
                    toolUse: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <WrenchIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchToolUseCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchToolUseCapabilityDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchWebSearchCapability")}
              checked={capabilities.webSearch === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  type: "chat",
                  capabilities: {
                    ...prev.capabilities,
                    chat: true,
                    webSearch: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <SearchIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchWebSearchCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchWebSearchCapabilityDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchEmbeddingCapability")}
              checked={capabilities.embedding === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  capabilities: {
                    ...prev.capabilities,
                    embedding: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <DatabaseIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchEmbeddingCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchEmbeddingCapabilityDesc")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={t("settings.aiWorkbenchRerankCapability")}
              checked={capabilities.rerank === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setModelForm((prev) => ({
                  ...prev,
                  capabilities: {
                    ...prev.capabilities,
                    rerank: checked,
                  },
                }));
              }}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <ListFilterIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">
                {t("settings.aiWorkbenchRerankCapability")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("settings.aiWorkbenchRerankCapabilityDesc")}
              </span>
            </span>
          </label>
        </div>
      </div>
    </>
  );
}
