import { DomainError } from "../../shared/types/errors.ts";
import { PipelineConfig } from "../../../application/services/pipeline-orchestrator.ts";
import { Schema } from "../../schema/entities/schema.ts";

/**
 * Pipeline state discriminated union following Totality principles
 * Represents the complete lifecycle of pipeline execution
 */
export type PipelineState =
  | {
    readonly kind: "initializing";
    readonly startTime: number;
    readonly config: PipelineConfig;
  }
  | {
    readonly kind: "schema-loading";
    readonly config: PipelineConfig;
    readonly loadingStartTime: number;
  }
  | {
    readonly kind: "template-resolving";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly resolutionStartTime: number;
  }
  | {
    readonly kind: "document-processing";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly templatePath: string;
    readonly itemsTemplatePath?: string;
    readonly outputFormat: string;
    readonly processingStartTime: number;
  }
  | {
    readonly kind: "data-preparing";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly templatePath: string;
    readonly itemsTemplatePath?: string;
    readonly outputFormat: string;
    readonly processedDocuments: unknown[]; // Will be typed more specifically later
    readonly preparationStartTime: number;
  }
  | {
    readonly kind: "output-rendering";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly templatePath: string;
    readonly itemsTemplatePath?: string;
    readonly outputFormat: string;
    readonly mainData: unknown[];
    readonly itemsData?: unknown[];
    readonly renderingStartTime: number;
  }
  | {
    readonly kind: "completed";
    readonly config: PipelineConfig;
    readonly completedAt: number;
    readonly totalExecutionTime: number;
    readonly result: void; // Pipeline returns void on success
  }
  | {
    readonly kind: "failed";
    readonly config: PipelineConfig;
    readonly error: DomainError;
    readonly failedAt: number;
    readonly failedStage: string;
    readonly partialData?: {
      schema?: Schema;
      templatePath?: string;
      processedDocuments?: unknown[];
      mainData?: unknown[];
    };
  };

/**
 * Pipeline state factory with type guards
 */
export class PipelineStateFactory {
  static createInitializing(config: PipelineConfig): PipelineState {
    return {
      kind: "initializing",
      startTime: Date.now(),
      config,
    };
  }

  static createSchemaLoading(
    config: PipelineConfig,
  ): PipelineState {
    return {
      kind: "schema-loading",
      config,
      loadingStartTime: Date.now(),
    };
  }

  static createTemplateResolving(
    config: PipelineConfig,
    schema: Schema,
  ): PipelineState {
    return {
      kind: "template-resolving",
      config,
      schema,
      resolutionStartTime: Date.now(),
    };
  }

  static createDocumentProcessing(
    config: PipelineConfig,
    schema: Schema,
    templatePath: string,
    itemsTemplatePath: string | undefined,
    outputFormat: string,
  ): PipelineState {
    return {
      kind: "document-processing",
      config,
      schema,
      templatePath,
      itemsTemplatePath,
      outputFormat,
      processingStartTime: Date.now(),
    };
  }

  static createDataPreparing(
    config: PipelineConfig,
    schema: Schema,
    templatePath: string,
    itemsTemplatePath: string | undefined,
    outputFormat: string,
    processedDocuments: unknown[],
  ): PipelineState {
    return {
      kind: "data-preparing",
      config,
      schema,
      templatePath,
      itemsTemplatePath,
      outputFormat,
      processedDocuments,
      preparationStartTime: Date.now(),
    };
  }

  static createOutputRendering(
    config: PipelineConfig,
    schema: Schema,
    templatePath: string,
    itemsTemplatePath: string | undefined,
    outputFormat: string,
    mainData: unknown[],
    itemsData: unknown[] | undefined,
  ): PipelineState {
    return {
      kind: "output-rendering",
      config,
      schema,
      templatePath,
      itemsTemplatePath,
      outputFormat,
      mainData,
      itemsData,
      renderingStartTime: Date.now(),
    };
  }

  static createCompleted(
    config: PipelineConfig,
    totalExecutionTime: number,
  ): PipelineState {
    return {
      kind: "completed",
      config,
      completedAt: Date.now(),
      totalExecutionTime,
      result: void 0,
    };
  }

  static createFailed(
    config: PipelineConfig,
    error: DomainError,
    failedStage: string,
    partialData?: {
      schema?: Schema;
      templatePath?: string;
      processedDocuments?: unknown[];
      mainData?: unknown[];
    },
  ): PipelineState {
    return {
      kind: "failed",
      config,
      error,
      failedAt: Date.now(),
      failedStage,
      partialData,
    };
  }
}

/**
 * Type guards for pipeline state discrimination
 */
export const PipelineStateGuards = {
  isInitializing: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "initializing" }> =>
    state.kind === "initializing",

  isSchemaLoading: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "schema-loading" }> =>
    state.kind === "schema-loading",

  isTemplateResolving: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "template-resolving" }> =>
    state.kind === "template-resolving",

  isDocumentProcessing: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "document-processing" }> =>
    state.kind === "document-processing",

  isDataPreparing: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "data-preparing" }> =>
    state.kind === "data-preparing",

  isOutputRendering: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "output-rendering" }> =>
    state.kind === "output-rendering",

  isCompleted: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "completed" }> =>
    state.kind === "completed",

  isFailed: (
    state: PipelineState,
  ): state is Extract<PipelineState, { kind: "failed" }> =>
    state.kind === "failed",

  isTerminal: (state: PipelineState): boolean =>
    state.kind === "completed" || state.kind === "failed",

  hasSchema: (state: PipelineState): boolean =>
    state.kind === "template-resolving" ||
    state.kind === "document-processing" ||
    state.kind === "data-preparing" ||
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" && state.partialData?.schema !== undefined),

  hasTemplateInfo: (state: PipelineState): boolean =>
    state.kind === "document-processing" ||
    state.kind === "data-preparing" ||
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" && state.partialData?.templatePath !== undefined),

  hasProcessedDocuments: (state: PipelineState): boolean =>
    state.kind === "data-preparing" ||
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" &&
      state.partialData?.processedDocuments !== undefined),

  hasRenderingData: (state: PipelineState): boolean =>
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" && state.partialData?.mainData !== undefined),
};
