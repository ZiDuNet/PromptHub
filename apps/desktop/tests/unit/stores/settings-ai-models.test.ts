import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const changeLanguageMock = vi.fn();

vi.mock("../../../src/renderer/i18n", () => ({
  __esModule: true,
  default: { language: "en" },
  changeLanguage: changeLanguageMock,
}));

describe("settings ai model actions", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    changeLanguageMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("removes scenario defaults that point to a deleted model", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");

    useSettingsStore.setState({
      aiModels: [
        {
          id: "chat-a",
          type: "chat",
          provider: "openai",
          apiKey: "key-a",
          apiUrl: "https://api.openai.com",
          model: "gpt-4.1",
          isDefault: true,
        },
        {
          id: "chat-b",
          type: "chat",
          provider: "anthropic",
          apiKey: "key-b",
          apiUrl: "https://api.anthropic.com",
          model: "claude-sonnet-4",
        },
      ],
      scenarioModelDefaults: {
        quickAdd: "chat-b",
        translation: "chat-a",
      },
      modelRouteDefaults: {
        fastText: "chat-b",
        mainText: "chat-a",
      },
    });

    useSettingsStore.getState().deleteAiModel("chat-b");

    expect(useSettingsStore.getState().scenarioModelDefaults).toEqual({
      translation: "chat-a",
    });
    expect(useSettingsStore.getState().modelRouteDefaults).toEqual({
      mainText: "chat-a",
    });
  });

  it("stores model capabilities and switches them when the model becomes image generation", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");

    useSettingsStore.getState().addAiModel({
      type: "chat",
      provider: "openai",
      apiProtocol: "openai",
      apiKey: "key-a",
      apiUrl: "https://api.openai.com",
      model: "gpt-4o",
      capabilities: { vision: true },
    });

    const created = useSettingsStore.getState().aiModels[0];
    expect(created.capabilities).toEqual({
      chat: true,
      vision: true,
      imageGeneration: false,
      reasoning: false,
      toolUse: false,
      webSearch: false,
      embedding: false,
      rerank: false,
    });

    useSettingsStore.getState().updateAiModel(created.id, {
      type: "image",
      model: "gpt-image-1",
    });

    expect(useSettingsStore.getState().aiModels[0]).toMatchObject({
      type: "image",
      model: "gpt-image-1",
    });
    expect(useSettingsStore.getState().aiModels[0].capabilities).toEqual({
      chat: false,
      vision: false,
      imageGeneration: true,
      reasoning: false,
      toolUse: false,
      webSearch: false,
      embedding: false,
      rerank: false,
    });
  });

  it("stores future-facing capability flags independently from model type", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");

    useSettingsStore.getState().addAiModel({
      type: "chat",
      provider: "openai",
      apiProtocol: "openai",
      apiKey: "key-a",
      apiUrl: "https://api.openai.com",
      model: "gpt-4.1",
      capabilities: {
        reasoning: true,
        toolUse: true,
        webSearch: true,
        embedding: true,
        rerank: true,
      },
    });

    expect(useSettingsStore.getState().aiModels[0].capabilities).toEqual({
      chat: true,
      vision: false,
      imageGeneration: false,
      reasoning: true,
      toolUse: true,
      webSearch: true,
      embedding: true,
      rerank: true,
    });
  });

  it("stores model route defaults independently from business scenario defaults", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");

    useSettingsStore.getState().setModelRouteDefault("fastText", "chat-fast");

    expect(useSettingsStore.getState().modelRouteDefaults).toEqual({
      fastText: "chat-fast",
    });
    expect(useSettingsStore.getState().scenarioModelDefaults).toEqual({});
  });

  it("stores provider endpoints independently from model records", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");

    useSettingsStore.getState().addAiProvider({
      name: "Work OpenAI",
      provider: "openai",
      apiProtocol: "openai",
      apiKey: "provider-key",
      apiUrl: "https://api.openai.com/v1",
    });

    expect(useSettingsStore.getState().aiProviders).toEqual([
      expect.objectContaining({
        name: "Work OpenAI",
        provider: "openai",
        apiProtocol: "openai",
        apiKey: "provider-key",
        apiUrl: "https://api.openai.com/v1",
      }),
    ]);
    expect(useSettingsStore.getState().aiModels).toEqual([]);
  });
});
