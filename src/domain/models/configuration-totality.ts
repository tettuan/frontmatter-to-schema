/**
 * Totality-compliant Configuration Models
 *
 * Refactored configuration system following Totality principles:
 * - Eliminates optional properties using discriminated unions
 * - Implements Smart Constructor pattern for validation
 * - Uses Result types for error handling
 * - Ensures no "impossible states" exist
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import type {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "./value-objects.ts";

/**
 * Processing Mode Configuration - Discriminated Union
 * Replaces optional parallel/maxConcurrency/continueOnError properties
 */
export type ProcessingMode =
  | {
    kind: "Sequential";
    continueOnError: boolean;
  }
  | {
    kind: "Parallel";
    maxConcurrency: number;
    continueOnError: boolean;
  };

/**
 * AI Provider Configuration - Discriminated Union
 * Replaces optional apiKey/model/maxTokens/temperature properties
 */
export type AIProviderConfig =
  | {
    kind: "Claude";
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  }
  | {
    kind: "OpenAI";
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  }
  | {
    kind: "Local";
    endpoint: string;
    timeout: number;
  }
  | {
    kind: "Mock";
    responses: Record<string, unknown>;
  };

/**
 * Prompt Configuration - Discriminated Union
 * Replaces optional promptsPath/extractionPrompt/mappingPrompt properties
 */
export type PromptConfig =
  | {
    kind: "Default";
    useBuiltInPrompts: true;
  }
  | {
    kind: "Custom";
    extractionPrompt: string;
    mappingPrompt: string;
  }
  | {
    kind: "File";
    promptsPath: ConfigPath;
  };

/**
 * Smart Constructor for ProcessingMode
 */
export class ProcessingModeFactory {
  static createSequential(
    continueOnError: boolean = true,
  ): Result<ProcessingMode, DomainError & { message: string }> {
    return {
      ok: true,
      data: { kind: "Sequential", continueOnError },
    };
  }

  static createParallel(
    maxConcurrency: number,
    continueOnError: boolean = true,
  ): Result<ProcessingMode, DomainError & { message: string }> {
    if (maxConcurrency < 1) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxConcurrency,
          min: 1,
          message: "maxConcurrency must be at least 1",
        }),
      };
    }

    if (maxConcurrency > 50) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxConcurrency,
          max: 50,
          message: "maxConcurrency cannot exceed 50",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "Parallel", maxConcurrency, continueOnError },
    };
  }
}

/**
 * Smart Constructor for AI Provider Configuration
 */
export class AIProviderConfigFactory {
  static createClaude(
    apiKey: string,
    model: string = "claude-3-sonnet-20240229",
    maxTokens: number = 4000,
    temperature: number = 0.1,
  ): Result<AIProviderConfig, DomainError & { message: string }> {
    if (!apiKey || apiKey.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "apiKey",
          message: "Claude API key cannot be empty",
        }),
      };
    }

    if (temperature < 0 || temperature > 1) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: temperature,
          min: 0,
          max: 1,
          message: "Temperature must be between 0 and 1",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "Claude", apiKey, model, maxTokens, temperature },
    };
  }

  static createOpenAI(
    apiKey: string,
    model: string = "gpt-4",
    maxTokens: number = 4000,
    temperature: number = 0.1,
  ): Result<AIProviderConfig, DomainError & { message: string }> {
    if (!apiKey || apiKey.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "apiKey",
          message: "OpenAI API key cannot be empty",
        }),
      };
    }

    if (temperature < 0 || temperature > 2) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: temperature,
          min: 0,
          max: 2,
          message: "Temperature must be between 0 and 2 for OpenAI",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "OpenAI", apiKey, model, maxTokens, temperature },
    };
  }

  static createLocal(
    endpoint: string,
    timeout: number = 30000,
  ): Result<AIProviderConfig, DomainError & { message: string }> {
    if (!endpoint || endpoint.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "endpoint",
          message: "Local endpoint cannot be empty",
        }),
      };
    }

    try {
      new URL(endpoint);
    } catch {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: endpoint,
          expectedFormat: "valid URL",
          message: "Invalid endpoint URL format",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "Local", endpoint, timeout },
    };
  }

  static createMock(
    responses: Record<string, unknown>,
  ): Result<AIProviderConfig, DomainError & { message: string }> {
    if (!responses || Object.keys(responses).length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "responses",
          message: "Mock responses cannot be empty",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "Mock", responses },
    };
  }
}

/**
 * Smart Constructor for Prompt Configuration
 */
export class PromptConfigFactory {
  static createDefault(): Result<
    PromptConfig,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: { kind: "Default", useBuiltInPrompts: true },
    };
  }

  static createCustom(
    extractionPrompt: string,
    mappingPrompt: string,
  ): Result<PromptConfig, DomainError & { message: string }> {
    if (!extractionPrompt || extractionPrompt.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "extractionPrompt",
          message: "Extraction prompt cannot be empty",
        }),
      };
    }

    if (!mappingPrompt || mappingPrompt.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "mappingPrompt",
          message: "Mapping prompt cannot be empty",
        }),
      };
    }

    return {
      ok: true,
      data: { kind: "Custom", extractionPrompt, mappingPrompt },
    };
  }

  static createFromFile(
    promptsPath: ConfigPath,
  ): Result<PromptConfig, DomainError & { message: string }> {
    return {
      ok: true,
      data: { kind: "File", promptsPath },
    };
  }
}

/**
 * Totality-compliant Processing Configuration
 * Replaces the old ProcessingConfiguration with optional properties
 */
export class ProcessingConfiguration {
  private constructor(
    private readonly mode: ProcessingMode,
    private readonly aiProvider: AIProviderConfig,
    private readonly prompts: PromptConfig,
  ) {}

  static create(
    mode: ProcessingMode,
    aiProvider: AIProviderConfig,
    prompts: PromptConfig,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    return {
      ok: true,
      data: new ProcessingConfiguration(mode, aiProvider, prompts),
    };
  }

  getMode(): ProcessingMode {
    return this.mode;
  }

  getAIProvider(): AIProviderConfig {
    return this.aiProvider;
  }

  getPrompts(): PromptConfig {
    return this.prompts;
  }

  isSequentialMode(): boolean {
    return this.mode.kind === "Sequential";
  }

  isParallelMode(): boolean {
    return this.mode.kind === "Parallel";
  }

  shouldContinueOnError(): boolean {
    return this.mode.continueOnError;
  }

  getMaxConcurrency(): number | undefined {
    return this.mode.kind === "Parallel" ? this.mode.maxConcurrency : undefined;
  }
}

/**
 * Document Processing Request - combines paths with processing configuration
 * Replaces the old DocumentProcessingRequest interface
 */
export class DocumentProcessingRequest {
  private constructor(
    private readonly documentsPath: DocumentPath,
    private readonly schemaPath: ConfigPath,
    private readonly templatePath: TemplatePath,
    private readonly outputPath: OutputPath,
    private readonly processingConfig: ProcessingConfiguration,
  ) {}

  static create(
    documentsPath: DocumentPath,
    schemaPath: ConfigPath,
    templatePath: TemplatePath,
    outputPath: OutputPath,
    processingConfig: ProcessingConfiguration,
  ): Result<DocumentProcessingRequest, DomainError & { message: string }> {
    return {
      ok: true,
      data: new DocumentProcessingRequest(
        documentsPath,
        schemaPath,
        templatePath,
        outputPath,
        processingConfig,
      ),
    };
  }

  getDocumentsPath(): DocumentPath {
    return this.documentsPath;
  }

  getSchemaPath(): ConfigPath {
    return this.schemaPath;
  }

  getTemplatePath(): TemplatePath {
    return this.templatePath;
  }

  getOutputPath(): OutputPath {
    return this.outputPath;
  }

  getProcessingConfig(): ProcessingConfiguration {
    return this.processingConfig;
  }
}

/**
 * Legacy Migration Adapter
 * Provides backward compatibility during migration period
 */
export class ConfigurationMigrationAdapter {
  static fromLegacyProcessingConfiguration(legacy: {
    parallel?: boolean;
    maxConcurrency?: number;
    continueOnError?: boolean;
  }): Result<ProcessingMode, DomainError & { message: string }> {
    const continueOnError = legacy.continueOnError ?? true;

    if (legacy.parallel) {
      const maxConcurrency = legacy.maxConcurrency ?? 4;
      return ProcessingModeFactory.createParallel(
        maxConcurrency,
        continueOnError,
      );
    }

    return ProcessingModeFactory.createSequential(continueOnError);
  }

  static fromLegacyAnalysisConfiguration(legacy: {
    promptsPath?: ConfigPath;
    extractionPrompt?: string;
    mappingPrompt?: string;
    aiProvider: "claude" | "openai" | "local" | "mock";
    aiConfig: {
      apiKey?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
    };
  }): Result<
    { aiProvider: AIProviderConfig; prompts: PromptConfig },
    DomainError & { message: string }
  > {
    // Convert AI Provider
    let aiProviderResult: Result<
      AIProviderConfig,
      DomainError & { message: string }
    >;

    switch (legacy.aiProvider) {
      case "claude":
        aiProviderResult = AIProviderConfigFactory.createClaude(
          legacy.aiConfig.apiKey || "",
          legacy.aiConfig.model,
          legacy.aiConfig.maxTokens,
          legacy.aiConfig.temperature,
        );
        break;
      case "openai":
        aiProviderResult = AIProviderConfigFactory.createOpenAI(
          legacy.aiConfig.apiKey || "",
          legacy.aiConfig.model,
          legacy.aiConfig.maxTokens,
          legacy.aiConfig.temperature,
        );
        break;
      case "local":
        aiProviderResult = AIProviderConfigFactory.createLocal(
          legacy.aiConfig.apiKey || "http://localhost:8000",
        );
        break;
      case "mock":
        aiProviderResult = AIProviderConfigFactory.createMock({});
        break;
    }

    if (!aiProviderResult.ok) {
      return aiProviderResult;
    }

    // Convert Prompts
    let promptsResult: Result<PromptConfig, DomainError & { message: string }>;

    if (legacy.promptsPath) {
      promptsResult = PromptConfigFactory.createFromFile(legacy.promptsPath);
    } else if (legacy.extractionPrompt && legacy.mappingPrompt) {
      promptsResult = PromptConfigFactory.createCustom(
        legacy.extractionPrompt,
        legacy.mappingPrompt,
      );
    } else {
      promptsResult = PromptConfigFactory.createDefault();
    }

    if (!promptsResult.ok) {
      return promptsResult;
    }

    return {
      ok: true,
      data: {
        aiProvider: aiProviderResult.data,
        prompts: promptsResult.data,
      },
    };
  }
}
