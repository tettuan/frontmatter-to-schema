# ドメインアーキテクチャ設計 - Aggregationドメイン

## 概要

本書は、複数の処理結果の集約と派生フィールド生成を担うAggregationドメインのアーキテクチャを定義する。

## Aggregationドメインモデル

### 1. 値オブジェクト

```typescript
import { Result, ValidationError } from "../shared/types";

/**
 * 集約ルール
 * x-derived-from と x-derived-unique に対応
 */
export class AggregationRule {
  private constructor(
    private readonly targetField: string,
    private readonly sourceExpression: string,
    private readonly unique: boolean,
    private readonly flatten: boolean = true,
  ) {}

  static create(
    targetField: string,
    sourceExpression: string,
    options?: {
      unique?: boolean;
      flatten?: boolean;
    },
  ): Result<AggregationRule, ValidationError> {
    // ターゲットフィールド検証
    if (!targetField || targetField.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Target field cannot be empty" },
      };
    }

    // ソース式検証
    if (!sourceExpression || sourceExpression.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Source expression cannot be empty",
        },
      };
    }

    // JSONPath式の基本検証
    if (!this.isValidJSONPath(sourceExpression)) {
      return {
        ok: false,
        error: {
          kind: "InvalidExpression",
          expression: sourceExpression,
          message: "Source expression must be a valid JSONPath",
        },
      };
    }

    return {
      ok: true,
      data: new AggregationRule(
        targetField,
        sourceExpression,
        options?.unique ?? false,
        options?.flatten ?? true,
      ),
    };
  }

  private static isValidJSONPath(expression: string): boolean {
    // 基本的なJSONPathパターンの検証
    // 例: "commands[].c1", "tools.configs[*].name", "data..value"
    const patterns = [
      /^[a-zA-Z_][a-zA-Z0-9_]*$/, // 単純なプロパティ
      /^\$\./, // ルートパス
      /\[\]/, // 配列展開
      /\[\*\]/, // 配列ワイルドカード
      /\.\./, // 再帰下降
      /\[[0-9]+\]/, // インデックス
    ];

    return patterns.some((pattern) => pattern.test(expression));
  }

  getTargetField(): string {
    return this.targetField;
  }
  getSourceExpression(): string {
    return this.sourceExpression;
  }
  isUnique(): boolean {
    return this.unique;
  }
  shouldFlatten(): boolean {
    return this.flatten;
  }
}

/**
 * 集約コンテキスト
 * 集約処理の範囲とオプションを定義
 */
export class AggregationContext {
  private constructor(
    private readonly scope: AggregationScope,
    private readonly rules: AggregationRule[],
    private readonly options: AggregationOptions,
  ) {}

  static create(
    scope: AggregationScope,
    rules: AggregationRule[],
    options?: Partial<AggregationOptions>,
  ): Result<AggregationContext, ValidationError> {
    if (rules.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "At least one aggregation rule is required",
        },
      };
    }

    // ターゲットフィールドの重複チェック
    const targetFields = new Set<string>();
    for (const rule of rules) {
      const target = rule.getTargetField();
      if (targetFields.has(target)) {
        return {
          ok: false,
          error: {
            kind: "DuplicateTarget",
            field: target,
            message: `Duplicate target field: ${target}`,
          },
        };
      }
      targetFields.add(target);
    }

    const fullOptions: AggregationOptions = {
      skipNull: options?.skipNull ?? true,
      skipUndefined: options?.skipUndefined ?? true,
      preserveOrder: options?.preserveOrder ?? false,
      maxDepth: options?.maxDepth ?? 100,
    };

    return {
      ok: true,
      data: new AggregationContext(scope, rules, fullOptions),
    };
  }

  getScope(): AggregationScope {
    return this.scope;
  }
  getRules(): AggregationRule[] {
    return [...this.rules];
  }
  getOptions(): AggregationOptions {
    return { ...this.options };
  }
}

/**
 * 集約スコープ
 */
export type AggregationScope =
  | { kind: "Global" } // 全データ対象
  | { kind: "Group"; groupBy: string } // グループ単位
  | { kind: "Window"; size: number }; // ウィンドウ単位

/**
 * 集約オプション
 */
export interface AggregationOptions {
  readonly skipNull: boolean;
  readonly skipUndefined: boolean;
  readonly preserveOrder: boolean;
  readonly maxDepth: number;
}

/**
 * 集約結果
 */
export class AggregatedResult {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: AggregationMetadata,
  ) {}

  static create(
    data: Record<string, unknown>,
    metadata: AggregationMetadata,
  ): Result<AggregatedResult, ValidationError> {
    if (!data || Object.keys(data).length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Aggregated data cannot be empty",
        },
      };
    }

    return {
      ok: true,
      data: new AggregatedResult(data, metadata),
    };
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }
  getMetadata(): AggregationMetadata {
    return { ...this.metadata };
  }

  get(field: string): unknown {
    return this.data[field];
  }

  has(field: string): boolean {
    return field in this.data;
  }

  getFields(): string[] {
    return Object.keys(this.data);
  }
}

/**
 * 集約メタデータ
 */
export interface AggregationMetadata {
  readonly processedCount: number;
  readonly aggregatedAt: Date;
  readonly appliedRules: string[];
  readonly warnings?: string[];
  readonly statistics?: AggregationStatistics;
}

/**
 * 集約統計
 */
export interface AggregationStatistics {
  readonly totalItems: number;
  readonly uniqueValues: Record<string, number>;
  readonly nullCount: Record<string, number>;
  readonly arrayLengths: Record<string, number[]>;
}
```

### 2. エンティティ

```typescript
/**
 * 集約プロセスの状態
 */
export type AggregationProcessState =
  | { kind: "Initialized"; context: AggregationContext }
  | { kind: "Collecting"; context: AggregationContext; items: ValidatedData[] }
  | { kind: "Processing"; context: AggregationContext; items: ValidatedData[] }
  | { kind: "Completed"; result: AggregatedResult }
  | { kind: "Failed"; error: AggregationError };

/**
 * 集約プロセスエンティティ
 */
export class AggregationProcess {
  private state: AggregationProcessState;

  private constructor(
    private readonly id: ProcessId,
    initialContext: AggregationContext,
  ) {
    this.state = { kind: "Initialized", context: initialContext };
  }

  static create(
    id: ProcessId,
    context: AggregationContext,
  ): AggregationProcess {
    return new AggregationProcess(id, context);
  }

  // 状態遷移メソッド
  startCollecting(): Result<void, AggregationError> {
    if (this.state.kind !== "Initialized") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Collecting",
          message: `Cannot start collecting from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Collecting",
      context: this.state.context,
      items: [],
    };

    return { ok: true, data: undefined };
  }

  addItem(item: ValidatedData): Result<void, AggregationError> {
    if (this.state.kind !== "Collecting") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Collecting",
          message: `Cannot add item in state: ${this.state.kind}`,
        },
      };
    }

    this.state.items.push(item);
    return { ok: true, data: undefined };
  }

  startProcessing(): Result<void, AggregationError> {
    if (this.state.kind !== "Collecting") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Processing",
          message: `Cannot start processing from state: ${this.state.kind}`,
        },
      };
    }

    if (this.state.items.length === 0) {
      return {
        ok: false,
        error: {
          kind: "NoDataToAggregate",
          message: "No items to aggregate",
        },
      };
    }

    this.state = {
      kind: "Processing",
      context: this.state.context,
      items: this.state.items,
    };

    return { ok: true, data: undefined };
  }

  complete(result: AggregatedResult): Result<void, AggregationError> {
    if (this.state.kind !== "Processing") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Completed",
          message: `Cannot complete from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Completed",
      result,
    };

    return { ok: true, data: undefined };
  }

  fail(error: AggregationError): void {
    this.state = { kind: "Failed", error };
  }

  // クエリメソッド
  getId(): ProcessId {
    return this.id;
  }
  getState(): AggregationProcessState {
    return this.state;
  }

  isCompleted(): boolean {
    return this.state.kind === "Completed";
  }

  getResult(): Result<AggregatedResult, AggregationError> {
    if (this.state.kind !== "Completed") {
      return {
        ok: false,
        error: {
          kind: "NotCompleted",
          state: this.state.kind,
          message:
            `Process is not completed, current state: ${this.state.kind}`,
        },
      };
    }

    return { ok: true, data: this.state.result };
  }

  getItemCount(): number {
    switch (this.state.kind) {
      case "Collecting":
      case "Processing":
        return this.state.items.length;
      default:
        return 0;
    }
  }
}

/**
 * プロセスID
 */
export class ProcessId {
  private constructor(private readonly value: string) {}

  static create(value?: string): ProcessId {
    const id = value ||
      `agg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return new ProcessId(id);
  }

  equals(other: ProcessId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### 3. ドメインサービス

```typescript
/**
 * 式評価サービス
 */
export class ExpressionEvaluator {
  evaluate(
    data: Record<string, unknown>,
    expression: string,
  ): Result<unknown[], EvaluationError> {
    try {
      const results = this.evaluateJSONPath(data, expression);
      return { ok: true, data: results };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "EvaluationFailed",
          expression,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to evaluate expression: ${expression}`,
        },
      };
    }
  }

  private evaluateJSONPath(
    data: Record<string, unknown>,
    expression: string,
  ): unknown[] {
    // JSONPath評価の簡易実装
    // 実際はjsonpathライブラリを使用

    const results: unknown[] = [];

    // "commands[].c1" パターン
    if (expression.includes("[]")) {
      const parts = expression.split("[]");
      const arrayPath = parts[0];
      const propertyPath = parts[1]?.substring(1); // Remove leading dot

      const array = this.getNestedValue(data, arrayPath);
      if (Array.isArray(array)) {
        for (const item of array) {
          if (propertyPath && typeof item === "object" && item !== null) {
            const value = this.getNestedValue(item, propertyPath);
            if (value !== undefined) {
              results.push(value);
            }
          } else if (!propertyPath) {
            results.push(item);
          }
        }
      }
    } // 単純なプロパティパス
    else {
      const value = this.getNestedValue(data, expression);
      if (value !== undefined) {
        results.push(value);
      }
    }

    return results;
  }

  private getNestedValue(obj: any, path: string): unknown {
    const segments = path.split(".");
    let current = obj;

    for (const segment of segments) {
      if (current == null || typeof current !== "object") {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }
}

/**
 * 集約実行サービス
 */
export class AggregationExecutor {
  constructor(
    private readonly evaluator: ExpressionEvaluator,
  ) {}

  execute(
    process: AggregationProcess,
  ): Result<AggregatedResult, AggregationError> {
    const state = process.getState();

    if (state.kind !== "Processing") {
      return {
        ok: false,
        error: {
          kind: "InvalidState",
          state: state.kind,
          message: `Process must be in Processing state, got: ${state.kind}`,
        },
      };
    }

    const { context, items } = state;
    const aggregated: Record<string, unknown> = {};
    const warnings: string[] = [];
    const statistics: AggregationStatistics = {
      totalItems: items.length,
      uniqueValues: {},
      nullCount: {},
      arrayLengths: {},
    };

    // 各ルールを適用
    for (const rule of context.getRules()) {
      const targetField = rule.getTargetField();
      const sourceExpression = rule.getSourceExpression();

      // 全アイテムから値を収集
      const allValues: unknown[] = [];

      for (const item of items) {
        const evalResult = this.evaluator.evaluate(
          item.getData(),
          sourceExpression,
        );

        if (evalResult.ok) {
          if (rule.shouldFlatten() && Array.isArray(evalResult.data)) {
            allValues.push(...evalResult.data.flat());
          } else {
            allValues.push(...evalResult.data);
          }
        } else {
          warnings.push(
            `Failed to evaluate ${sourceExpression}: ${evalResult.error.message}`,
          );
        }
      }

      // フィルタリング（null/undefined除去）
      const filtered = this.filterValues(allValues, context.getOptions());

      // ユニーク化
      let finalValues: unknown[] = filtered;
      if (rule.isUnique()) {
        finalValues = this.uniqueValues(filtered);
        statistics.uniqueValues[targetField] = finalValues.length;
      }

      // 統計情報の収集
      statistics.nullCount[targetField] = allValues.filter((v) =>
        v == null
      ).length;
      if (Array.isArray(finalValues[0])) {
        statistics.arrayLengths[targetField] = finalValues.map((v) =>
          Array.isArray(v) ? v.length : 0
        );
      }

      aggregated[targetField] = finalValues;
    }

    // 結果の作成
    const metadata: AggregationMetadata = {
      processedCount: items.length,
      aggregatedAt: new Date(),
      appliedRules: context.getRules().map((r) => r.getTargetField()),
      warnings: warnings.length > 0 ? warnings : undefined,
      statistics,
    };

    return AggregatedResult.create(aggregated, metadata);
  }

  private filterValues(
    values: unknown[],
    options: AggregationOptions,
  ): unknown[] {
    return values.filter((value) => {
      if (options.skipNull && value === null) return false;
      if (options.skipUndefined && value === undefined) return false;
      return true;
    });
  }

  private uniqueValues(values: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const value of values) {
      const key = this.getUniqueKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    return unique;
  }

  private getUniqueKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

/**
 * 派生フィールド生成サービス
 */
export class DerivationService {
  derive(
    result: AggregatedResult,
    rules: DerivationRule[],
  ): Result<EnrichedResult, DerivationError> {
    const data = result.getData();
    const enriched: Record<string, unknown> = { ...data };

    for (const rule of rules) {
      const derivedValue = this.deriveField(data, rule);
      if (!derivedValue.ok) return derivedValue;

      enriched[rule.getTargetField()] = derivedValue.data;
    }

    return EnrichedResult.create(enriched, result.getMetadata());
  }

  private deriveField(
    data: Record<string, unknown>,
    rule: DerivationRule,
  ): Result<unknown, DerivationError> {
    // 派生ロジックの実装
    // 例: 配列の長さ、合計、平均などの計算
    return { ok: true, data: null };
  }
}

/**
 * 派生結果
 */
export class EnrichedResult extends AggregatedResult {
  static create(
    data: Record<string, unknown>,
    metadata: AggregationMetadata,
  ): Result<EnrichedResult, ValidationError> {
    const baseResult = AggregatedResult.create(data, metadata);
    if (!baseResult.ok) return baseResult;

    return {
      ok: true,
      data: Object.setPrototypeOf(baseResult.data, EnrichedResult.prototype),
    };
  }
}
```

### 4. リポジトリインターフェース

```typescript
/**
 * 集約プロセスリポジトリ
 */
export interface AggregationProcessRepository {
  save(process: AggregationProcess): Promise<Result<void, AggregationError>>;
  findById(
    id: ProcessId,
  ): Promise<Result<AggregationProcess | null, AggregationError>>;
  findActive(): Promise<Result<AggregationProcess[], AggregationError>>;
  deleteCompleted(before: Date): Promise<Result<number, AggregationError>>;
}
```

### 5. エラー型定義

```typescript
export type AggregationError =
  | ValidationError
  | StateError
  | EvaluationError
  | DerivationError;

export type StateError =
  | {
    kind: "InvalidStateTransition";
    from: string;
    to: string;
    message: string;
  }
  | { kind: "InvalidState"; state: string; message: string }
  | { kind: "NotCompleted"; state: string; message: string }
  | { kind: "NoDataToAggregate"; message: string };

export type EvaluationError =
  | {
    kind: "EvaluationFailed";
    expression: string;
    error: string;
    message: string;
  }
  | { kind: "InvalidExpression"; expression: string; message: string };

export type DerivationError =
  | { kind: "DerivationFailed"; field: string; reason: string; message: string }
  | { kind: "CircularDependency"; fields: string[]; message: string };

// 共通のValidationError（他ドメインと共有）
export type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "PatternMismatch"; value: string; pattern: string; message: string }
  | { kind: "InvalidExpression"; expression: string; message: string }
  | { kind: "DuplicateTarget"; field: string; message: string };
```
