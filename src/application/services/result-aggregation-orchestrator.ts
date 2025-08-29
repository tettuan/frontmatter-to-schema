/**
 * Result Aggregation Orchestrator
 *
 * Application service that orchestrates domain services for result aggregation and output.
 * This service implements the proper DDD pattern of using domain services
 * and infrastructure services in coordination.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import type {
  AggregatedResult,
  AnalysisResult,
} from "../../domain/models/entities.ts";
import { RegistryAggregationService } from "../../domain/services/registry-aggregation-service.ts";
import {
  MultiFormatOutputService,
  type OutputFormat,
  OutputFormatterFactory,
} from "../../infrastructure/services/output-formatter.ts";

/**
 * Aggregation strategy discriminated union
 */
export type AggregationStrategy =
  | { kind: "Registry"; version?: string; description?: string }
  | { kind: "SimpleArray" }
  | { kind: "Auto" }; // Auto-detect based on data structure

/**
 * Result aggregation request
 */
export interface ResultAggregationRequest {
  readonly results: AnalysisResult[];
  readonly format: OutputFormat;
  readonly strategy: AggregationStrategy;
}

/**
 * Result aggregation response
 */
export interface ResultAggregationResponse {
  readonly output: string;
  readonly strategy: AggregationStrategy["kind"];
  readonly metadata: {
    readonly resultCount: number;
    readonly commandCount?: number;
    readonly configCount?: number;
  };
}

/**
 * Result Aggregation Orchestrator
 *
 * Coordinates domain services and infrastructure services to provide
 * complete result aggregation and formatting functionality.
 */
export class ResultAggregationOrchestrator {
  constructor(
    private readonly registryService = new RegistryAggregationService(),
    private readonly outputService = new MultiFormatOutputService(),
  ) {}

  /**
   * Aggregate results using the specified strategy
   */
  aggregate(
    request: ResultAggregationRequest,
  ): Result<ResultAggregationResponse, DomainError> {
    const { results, format, strategy } = request;

    if (results.length === 0) {
      const emptyOutput = this.formatEmpty(format);
      if (!emptyOutput.ok) {
        return emptyOutput;
      }

      return {
        ok: true,
        data: {
          output: emptyOutput.data,
          strategy: "SimpleArray",
          metadata: { resultCount: 0 },
        },
      };
    }

    // Determine actual strategy to use
    const actualStrategy = strategy.kind === "Auto"
      ? this.detectStrategy(results)
      : strategy;

    switch (actualStrategy.kind) {
      case "Registry":
        return this.aggregateAsRegistry(results, format, actualStrategy);
      case "SimpleArray":
        return this.aggregateAsArray(results, format);
      default:
        // This should never happen with proper totality, but handle gracefully
        return this.aggregateAsArray(results, format);
    }
  }

  /**
   * Legacy support - aggregate from AggregatedResult entity
   */
  aggregateFromEntity(
    aggregatedResult: AggregatedResult,
  ): Result<string, DomainError> {
    const results = aggregatedResult.getResults();
    const formatString = aggregatedResult.getFormat();

    const formatResult = OutputFormatterFactory.fromString(formatString);
    if (!formatResult.ok) {
      return formatResult;
    }

    const request: ResultAggregationRequest = {
      results,
      format: formatResult.data,
      strategy: { kind: "Auto" },
    };

    const aggregationResult = this.aggregate(request);
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    return {
      ok: true,
      data: aggregationResult.data.output,
    };
  }

  /**
   * Detect the appropriate strategy based on result content
   */
  private detectStrategy(results: AnalysisResult[]): AggregationStrategy {
    // Check if results contain frontmatter with command-like structure
    for (const result of results) {
      const document = result.getDocument();
      const frontMatterResult = document.getFrontMatterResult();

      if (frontMatterResult.ok) {
        const data = frontMatterResult.data.toObject();
        if (typeof data === "object" && data !== null && "c1" in data) {
          return { kind: "Registry" };
        }
      }
    }

    // Check mapped data for registry structure
    const mappedData = results.map((r) => r.getMappedData().getData());
    const structure = this.registryService.detectStructureType(mappedData);

    return structure.kind === "Generic"
      ? { kind: "SimpleArray" }
      : { kind: "Registry" };
  }

  /**
   * Aggregate results as registry structure
   */
  private aggregateAsRegistry(
    results: AnalysisResult[],
    format: OutputFormat,
    _strategy: Extract<AggregationStrategy, { kind: "Registry" }>,
  ): Result<ResultAggregationResponse, DomainError> {
    const registryResult = this.registryService.aggregateFromResults(results);
    if (!registryResult.ok) {
      return registryResult;
    }

    const registry = registryResult.data;
    const outputResult = this.outputService.format(registry.toObject(), format);
    if (!outputResult.ok) {
      return outputResult;
    }

    const tools = registry.getTools();
    return {
      ok: true,
      data: {
        output: outputResult.data,
        strategy: "Registry",
        metadata: {
          resultCount: results.length,
          commandCount: tools.commands.length,
          configCount: tools.availableConfigs.length,
        },
      },
    };
  }

  /**
   * Aggregate results as simple array
   */
  private aggregateAsArray(
    results: AnalysisResult[],
    format: OutputFormat,
  ): Result<ResultAggregationResponse, DomainError> {
    const data = results.map((r) => r.getMappedData().getData());
    const outputResult = this.outputService.format({ results: data }, format);
    if (!outputResult.ok) {
      return outputResult;
    }

    return {
      ok: true,
      data: {
        output: outputResult.data,
        strategy: "SimpleArray",
        metadata: {
          resultCount: results.length,
        },
      },
    };
  }

  /**
   * Format empty result set
   */
  private formatEmpty(
    format: OutputFormat,
  ): Result<string, DomainError> {
    return this.outputService.format({ results: [] }, format);
  }

  /**
   * Get supported strategies
   */
  getSupportedStrategies(): AggregationStrategy["kind"][] {
    return ["Registry", "SimpleArray", "Auto"];
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): OutputFormat["kind"][] {
    return this.outputService.getSupportedFormats();
  }
}
