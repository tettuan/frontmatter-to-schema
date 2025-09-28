import { DomainError } from "../../../domain/shared/types/errors.ts";
import { PipelineConfig } from "../../services/pipeline-orchestrator.ts";
import { Schema } from "../../../domain/schema/entities/schema.ts";

/**
 * Items template state using discriminated union for Totality compliance
 */
export type ItemsTemplatePathState =
  | { readonly kind: "defined"; readonly path: string }
  | { readonly kind: "not-defined" };

/**
 * Items data state using discriminated union for Totality compliance
 */
export type ItemsDataState =
  | { readonly kind: "available"; readonly data: unknown[] }
  | { readonly kind: "not-available" };

/**
 * Partial data state for failed pipeline execution using Totality principles
 */
export type PartialDataState =
  | { readonly kind: "no-partial-data" }
  | {
    readonly kind: "schema-loaded";
    readonly schema: Schema;
  }
  | {
    readonly kind: "template-resolved";
    readonly schema: Schema;
    readonly templatePath: string;
  }
  | {
    readonly kind: "documents-processed";
    readonly schema: Schema;
    readonly templatePath: string;
    readonly processedDocuments: unknown[];
  }
  | {
    readonly kind: "data-prepared";
    readonly schema: Schema;
    readonly templatePath: string;
    readonly processedDocuments: unknown[];
    readonly mainData: unknown[];
  };

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
    readonly itemsTemplatePath: ItemsTemplatePathState;
    readonly outputFormat: string;
    readonly processingStartTime: number;
  }
  | {
    readonly kind: "data-preparing";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly templatePath: string;
    readonly itemsTemplatePath: ItemsTemplatePathState;
    readonly outputFormat: string;
    readonly processedDocuments: unknown[]; // Will be typed more specifically later
    readonly preparationStartTime: number;
  }
  | {
    readonly kind: "output-rendering";
    readonly config: PipelineConfig;
    readonly schema: Schema;
    readonly templatePath: string;
    readonly itemsTemplatePath: ItemsTemplatePathState;
    readonly outputFormat: string;
    readonly mainData: unknown[];
    readonly itemsData: ItemsDataState;
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
    readonly partialData: PartialDataState;
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
    itemsTemplatePath: ItemsTemplatePathState,
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
    itemsTemplatePath: ItemsTemplatePathState,
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
    itemsTemplatePath: ItemsTemplatePathState,
    outputFormat: string,
    mainData: unknown[],
    itemsData: ItemsDataState,
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
    partialData: PartialDataState = { kind: "no-partial-data" },
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
    (state.kind === "failed" &&
      (state.partialData.kind === "schema-loaded" ||
        state.partialData.kind === "template-resolved" ||
        state.partialData.kind === "documents-processed" ||
        state.partialData.kind === "data-prepared")),

  hasTemplateInfo: (state: PipelineState): boolean =>
    state.kind === "document-processing" ||
    state.kind === "data-preparing" ||
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" &&
      (state.partialData.kind === "template-resolved" ||
        state.partialData.kind === "documents-processed" ||
        state.partialData.kind === "data-prepared")),

  hasProcessedDocuments: (state: PipelineState): boolean =>
    state.kind === "data-preparing" ||
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" &&
      (state.partialData.kind === "documents-processed" ||
        state.partialData.kind === "data-prepared")),

  hasRenderingData: (state: PipelineState): boolean =>
    state.kind === "output-rendering" ||
    state.kind === "completed" ||
    (state.kind === "failed" && state.partialData.kind === "data-prepared"),
};
