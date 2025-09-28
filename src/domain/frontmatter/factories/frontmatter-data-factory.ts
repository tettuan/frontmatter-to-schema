import { ok, Result } from "../../shared/types/result.ts";
import { FrontmatterError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { defaultFrontmatterDataCreationService } from "../services/frontmatter-data-creation-service.ts";

/**
 * Factory for creating FrontmatterData instances following DDD and Totality principles.
 * Delegates to FrontmatterDataCreationService to eliminate duplication.
 *
 * @deprecated Consider using FrontmatterDataCreationService directly for better DDD compliance
 */
export class FrontmatterDataFactory {
  private static readonly creationService =
    defaultFrontmatterDataCreationService;

  /**
   * Create FrontmatterData from unknown parsed data (default behavior)
   */
  static fromParsedData(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    return this.creationService.createFromRaw(data);
  }

  /**
   * Create FrontmatterData from a known object structure
   */
  static fromObject(
    obj: Record<string, unknown>,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return ErrorHandler.frontmatter({
        operation: "fromObject",
        method: "validateObject",
      }).malformedFrontmatter(JSON.stringify(obj).substring(0, 100));
    }
    return this.creationService.createFromRaw(obj);
  }

  /**
   * Create an array of FrontmatterData from an array of items
   */
  static fromArray(
    items: unknown[],
  ): Result<FrontmatterData[], FrontmatterError & { message: string }> {
    if (!Array.isArray(items)) {
      return ErrorHandler.frontmatter({
        operation: "fromArray",
        method: "validateArray",
      }).malformedFrontmatter(`Expected array but got ${typeof items}`);
    }

    return this.creationService.createFromArray(items);
  }

  /**
   * Create empty FrontmatterData
   */
  static empty(): FrontmatterData {
    return FrontmatterData.empty();
  }

  /**
   * Create FrontmatterData with default fallback for undefined/null values
   */
  static withDefault(
    data: unknown,
    defaultData: Record<string, unknown> = {},
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    return this.creationService.createWithDefaults(data, defaultData);
  }

  /**
   * Create FrontmatterData from multiple sources with merging
   */
  static fromMerged(
    ...sources: unknown[]
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    let merged: Record<string, unknown> = {};

    for (const source of sources) {
      if (source && typeof source === "object" && !Array.isArray(source)) {
        merged = { ...merged, ...source as Record<string, unknown> };
      }
    }

    return this.creationService.createFromRaw(merged);
  }

  /**
   * Batch create multiple FrontmatterData instances
   * Returns all successful creations and errors separately
   */
  static batchCreate(
    items: unknown[],
  ): {
    successful: FrontmatterData[];
    failed: Array<{
      index: number;
      error: FrontmatterError & { message: string };
    }>;
  } {
    // 全域性完全実現フロー - Result型チェーン統合デバッグ (Iteration 10)
    const _resultTypeChainIntegrationDebug = {
      integrationPoint: "frontmatter-data-factory-batch-create",
      totalityTransformationContext: {
        batchProcessingPipelineStage: "domain-factory-layer",
        inputValidationType: "unknown-array-to-typed-results",
        resultChainComplexity: "high", // Result型の配列処理
        errorAccumulationStrategy: "collect-and-continue", // エラー蓄積継続戦略
      },
      partialFunctionEliminationProgress: {
        nullUndefinedHandling: "smart-constructor-pattern", // null/undefined → Smart Constructor
        exceptionToResultConversion: "factory-method-pattern", // 例外 → Result型
        typeAssertionElimination: "type-guard-pattern", // 型assertion → Type Guard
        optionalChainReplacement: "result-chain-pattern", // Optional chain → Result chain
      },
      totalityImplementationVariance: {
        successFailureDivergence: "high-variance", // 成功/失敗パターンの分岐
        errorAccumulationComplexity: "medium-variance", // エラー蓄積の複雑性
        batchProcessingConsistency: "low-variance", // バッチ処理の一貫性
        factoryPatternStabilization: "high-variance", // Factory パターンの安定化
      },
      resultChainOptimizations: {
        earlyReturnElimination: "continue-processing", // 早期return回避
        errorContextPreservation: "index-tracking", // エラーコンテキスト保持
        successPathOptimization: "batch-accumulation", // 成功パス最適化
        memoryEfficiencyConsideration: "streaming-possible", // メモリ効率考慮
      },
      debugLogLevel: "detailed", // Result型チェーン詳細ログ
      totalityValidationEnabled: true, // 全域性検証有効
    };

    // Implementation performance tracking
    // Note: Logger removed as it's not part of the service interface

    const batchResult = this.creationService.createBatch(items);
    return {
      successful: batchResult.successful,
      failed: batchResult.errors,
    };
  }

  /**
   * Merge multiple FrontmatterData instances into one
   */
  static merge(
    dataArray: FrontmatterData[],
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (dataArray.length === 0) {
      return ok(this.creationService.createEmpty());
    }

    const sources = dataArray.map((data) => data.getData());
    return this.creationService.createFromMerge(
      sources[0],
      ...sources.slice(1),
    );
  }

  /**
   * Apply defaults to FrontmatterData
   */
  static withDefaults(
    data: FrontmatterData,
    defaults: Record<string, unknown>,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    return this.creationService.createWithDefaultsFromExisting(data, defaults);
  }
}
