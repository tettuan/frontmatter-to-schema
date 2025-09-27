import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * データ処理指示ドメイン (Data Processing Instruction Domain)
 *
 * 責務: フロントマターデータの加工と提供
 *
 * 要求:
 * - フロントマター解析結果を受け取り、x-ディレクティブに基づいて処理する
 * - すべてのデータアクセスを仲介し、処理済みデータのみを提供する
 * - フロントマター解析ドメインへの直接アクセスを隠蔽する
 * - Schema階層の要求に応じて適切なデータを返す
 */
export interface ProcessedDataCache {
  [schemaPath: string]: unknown;
}

export class DataProcessingInstructionDomainService {
  private sourceData: FrontmatterData[] = [];
  private processedCache: ProcessedDataCache = {};
  private schema: Schema | null = null;

  constructor() {}

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    DataProcessingInstructionDomainService,
    DomainError & { message: string }
  > {
    return ok(new DataProcessingInstructionDomainService());
  }

  /**
   * フロントマター解析結果を受け取り初期化する
   * init(input_data_from_frontmatter) に相当
   */
  initializeWithFrontmatterData(
    frontmatterData: FrontmatterData[],
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    if (!frontmatterData || frontmatterData.length === 0) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "Frontmatter data is required for data processing initialization",
      }));
    }

    if (!schema) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Schema is required for data processing initialization",
      }));
    }

    this.sourceData = [...frontmatterData]; // Copy to prevent external modification
    this.schema = schema;
    this.processedCache = {}; // Reset cache

    return ok(void 0);
  }

  /**
   * Schema階層の要求に応じて適切なデータを返す
   * call_method(schema_entity) に相当
   * x-* ディレクティブ処理済みの値が取得できる
   */
  getProcessedData(
    schemaPath: string,
  ): Result<unknown, DomainError & { message: string }> {
    if (!this.schema) {
      return err(createError({
        kind: "InitializationError",
        message:
          "Data processing service must be initialized before accessing data",
      }));
    }

    // Check cache first
    if (schemaPath in this.processedCache) {
      return ok(this.processedCache[schemaPath]);
    }

    // Process the schema path and apply directives
    const processResult = this.processSchemaPath(schemaPath);
    if (!processResult.ok) {
      return processResult;
    }

    // Cache the result
    this.processedCache[schemaPath] = processResult.data;

    return ok(processResult.data);
  }

  /**
   * Schema階層の要求に応じて、x-frontmatter-part配列のデータを返す
   * フロントマター配列から統合された配列データを提供
   */
  getFrontmatterPartArray(): Result<
    unknown[],
    DomainError & { message: string }
  > {
    if (!this.schema) {
      return err(createError({
        kind: "SchemaNotFound",
        path: "<none>",
      }, "Schema is required for frontmatter part processing"));
    }

    // Find x-frontmatter-part in schema
    const frontmatterPartPath = this.findFrontmatterPartPath();
    if (!frontmatterPartPath.ok) {
      return frontmatterPartPath;
    }

    // Extract frontmatter data as array
    const arrayData = this.sourceData.map((data) => data.getData());

    return ok(arrayData);
  }

  /**
   * 階層パスで指定されたデータを取得する（テンプレート変数解決用）
   * {id.full} のような指定に対応
   */
  resolveVariablePath(
    variablePath: string,
    isItemsTemplate: boolean = false,
  ): Result<unknown, DomainError & { message: string }> {
    if (!this.schema) {
      return err(createError({
        kind: "SchemaNotFound",
        path: "<none>",
      }, "Schema is required for variable path resolution"));
    }

    // Determine the root context based on template type
    if (isItemsTemplate) {
      // x-template-items: x-frontmatter-part指定階層が起点
      return this.resolveFromFrontmatterPartContext(variablePath);
    } else {
      // x-template: Schemaのrootが起点
      return this.resolveFromSchemaRootContext(variablePath);
    }
  }

  /**
   * 指定されたSchema階層が持つx-*指示を処理する
   * availableConfigs の場合は x-derived-from と x-derived-unique が処理される
   */
  private processSchemaPath(
    schemaPath: string,
  ): Result<unknown, DomainError & { message: string }> {
    const schemaProperty = this.getSchemaPropertyAtPath(schemaPath);
    if (!schemaProperty.ok) {
      return schemaProperty;
    }

    const property = schemaProperty.data;

    // Apply x-directive processing
    let processedData: unknown = this.sourceData.map((data) => data.getData());

    // Process x-derived-from directive
    const derivedFromResult = this.processXDerivedFrom(property, processedData);
    if (derivedFromResult.ok) {
      processedData = derivedFromResult.data;
    }

    // Process x-derived-unique directive
    const uniqueResult = this.processXDerivedUnique(property, processedData);
    if (uniqueResult.ok) {
      processedData = uniqueResult.data;
    }

    // Process x-flatten-arrays directive
    const flattenResult = this.processXFlattenArrays(property, processedData);
    if (flattenResult.ok) {
      processedData = flattenResult.data;
    }

    // Process x-jmespath-filter directive
    const jmespathResult = this.processXJmespathFilter(property, processedData);
    if (jmespathResult.ok) {
      processedData = jmespathResult.data;
    }

    return ok(processedData);
  }

  /**
   * PRIVATE: x-derived-from ディレクティブを処理する
   * 他のプロパティから値を集約
   */
  private processXDerivedFrom(
    property: Record<string, unknown>,
    sourceData: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    const derivedFrom = property["x-derived-from"];
    if (!derivedFrom || typeof derivedFrom !== "string") {
      return ok(sourceData); // No x-derived-from directive
    }

    // Parse derivation path like "commands[].c1"
    const derivedValues: unknown[] = [];

    if (Array.isArray(sourceData)) {
      for (const dataItem of sourceData) {
        const extractedValue = this.extractValueFromPath(dataItem, derivedFrom);
        if (extractedValue !== undefined) {
          if (Array.isArray(extractedValue)) {
            derivedValues.push(...extractedValue);
          } else {
            derivedValues.push(extractedValue);
          }
        }
      }
    } else {
      const extractedValue = this.extractValueFromPath(sourceData, derivedFrom);
      if (extractedValue !== undefined) {
        if (Array.isArray(extractedValue)) {
          derivedValues.push(...extractedValue);
        } else {
          derivedValues.push(extractedValue);
        }
      }
    }

    return ok(derivedValues);
  }

  /**
   * PRIVATE: x-derived-unique ディレクティブを処理する
   * 配列の重複要素を除去
   */
  private processXDerivedUnique(
    property: Record<string, unknown>,
    sourceData: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    const derivedUnique = property["x-derived-unique"];
    if (!derivedUnique) {
      return ok(sourceData); // No x-derived-unique directive
    }

    if (Array.isArray(sourceData)) {
      const uniqueValues = [...new Set(sourceData)];
      return ok(uniqueValues);
    }

    return ok(sourceData); // Not an array, return as-is
  }

  /**
   * PRIVATE: x-flatten-arrays ディレクティブを処理する
   * 配列構造のフラット化
   */
  private processXFlattenArrays(
    property: Record<string, unknown>,
    sourceData: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    const flattenArrays = property["x-flatten-arrays"];
    if (!flattenArrays) {
      return ok(sourceData); // No x-flatten-arrays directive
    }

    if (Array.isArray(sourceData)) {
      const flattened = this.flattenNestedArrays(sourceData);
      return ok(flattened);
    }

    return ok(sourceData); // Not an array, return as-is
  }

  /**
   * PRIVATE: x-jmespath-filter ディレクティブを処理する
   * JMESPath式によるデータフィルタリング
   */
  private processXJmespathFilter(
    property: Record<string, unknown>,
    sourceData: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    const jmespathFilter = property["x-jmespath-filter"];
    if (!jmespathFilter || typeof jmespathFilter !== "string") {
      return ok(sourceData); // No x-jmespath-filter directive
    }

    // Simplified JMESPath processing (in full implementation, use proper JMESPath library)
    try {
      const filteredData = this.applySimpleJmespathFilter(
        sourceData,
        jmespathFilter,
      );
      return ok(filteredData);
    } catch (error) {
      return err(createError({
        kind: "JMESPathExecutionFailed",
        expression: "<unknown>",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * PRIVATE: Schema内で指定されたパスのプロパティを取得
   */
  private getSchemaPropertyAtPath(
    path: string,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    if (!this.schema) {
      return err(createError({
        kind: "SchemaNotFound",
        path: "<none>",
      }, "Schema is required for property access"));
    }

    try {
      const rawSchema = this.schema.getRawSchema();
      const property = this.navigateSchemaPath(rawSchema, path);

      if (property && typeof property === "object") {
        return ok(property as Record<string, unknown>);
      } else {
        return err(createError({
          kind: "PropertyNotFound",
          path: path,
        }));
      }
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Failed to access schema property at ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * PRIVATE: Schema内のパスをナビゲート
   */
  private navigateSchemaPath(schema: unknown, path: string): unknown {
    if (!path) return schema;

    const pathParts = path.split(".");
    let current = schema;

    for (const part of pathParts) {
      if (typeof current === "object" && current !== null) {
        const record = current as Record<string, unknown>;
        if ("properties" in record && typeof record.properties === "object") {
          current = (record.properties as Record<string, unknown>)[part];
        } else if (part in record) {
          current = record[part];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * PRIVATE: x-frontmatter-partのパスを見つける
   */
  private findFrontmatterPartPath(): Result<
    string,
    DomainError & { message: string }
  > {
    if (!this.schema) {
      return err(createError({
        kind: "SchemaNotFound",
        path: "<none>",
      }, "Schema is required for frontmatter part detection"));
    }

    const rawSchema = this.schema.getRawSchema();
    const path = this.findFrontmatterPartInSchema(rawSchema, "");

    if (path) {
      return ok(path);
    } else {
      return err(createError({
        kind: "ConfigurationError",
        message: "x-frontmatter-part not found in schema",
      }));
    }
  }

  /**
   * PRIVATE: Schema内でx-frontmatter-partを再帰的に検索
   */
  private findFrontmatterPartInSchema(
    obj: unknown,
    currentPath: string,
  ): string | null {
    if (typeof obj !== "object" || obj === null) {
      return null;
    }

    const record = obj as Record<string, unknown>;

    // Check if this object has x-frontmatter-part
    if (record["x-frontmatter-part"] === true) {
      return currentPath;
    }

    // Search in properties
    if (record.properties && typeof record.properties === "object") {
      const properties = record.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const found = this.findFrontmatterPartInSchema(value, newPath);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * PRIVATE: x-template-itemsコンテキストで変数パスを解決
   */
  private resolveFromFrontmatterPartContext(
    variablePath: string,
  ): Result<unknown, DomainError & { message: string }> {
    // x-frontmatter-part指定階層が起点
    const frontmatterArray = this.getFrontmatterPartArray();
    if (!frontmatterArray.ok) {
      return frontmatterArray;
    }

    // For items template, we typically work with individual items
    // This would be called per item during template expansion
    // For now, return the first item as example
    if (frontmatterArray.data.length > 0) {
      const firstItem = frontmatterArray.data[0];
      return ok(this.extractValueFromPath(firstItem, variablePath));
    }

    return ok(undefined);
  }

  /**
   * PRIVATE: x-templateコンテキストで変数パスを解決
   */
  private resolveFromSchemaRootContext(
    variablePath: string,
  ): Result<unknown, DomainError & { message: string }> {
    // Schemaのrootが起点
    const processedResult = this.getProcessedData(variablePath);
    return processedResult;
  }

  /**
   * PRIVATE: パスから値を抽出するヘルパー
   */
  private extractValueFromPath(data: unknown, path: string): unknown {
    if (!data || typeof data !== "object") {
      return undefined;
    }

    // Handle array notation like "commands[].c1"
    if (path.includes("[]")) {
      const [arrayPath, propertyPath] = path.split("[].");
      const arrayValue = this.extractNestedProperty(
        data as Record<string, unknown>,
        arrayPath,
      );

      if (Array.isArray(arrayValue)) {
        return arrayValue.map((item) => {
          if (propertyPath) {
            return this.extractNestedProperty(
              item as Record<string, unknown>,
              propertyPath,
            );
          }
          return item;
        }).filter((value) => value !== undefined);
      }
    } else {
      return this.extractNestedProperty(data as Record<string, unknown>, path);
    }

    return undefined;
  }

  /**
   * PRIVATE: ネストしたプロパティを抽出
   */
  private extractNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        const currentResult = SafePropertyAccess.asRecord(current);
        if (currentResult.ok && part in currentResult.data) {
          current = currentResult.data[part];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * PRIVATE: 配列のフラット化を実行
   */
  private flattenNestedArrays(arr: unknown[]): unknown[] {
    const result: unknown[] = [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenNestedArrays(item));
      } else {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * PRIVATE: 簡単なJMESPathフィルターを適用
   * 完全な実装では適切なJMESPathライブラリを使用
   */
  private applySimpleJmespathFilter(data: unknown, _filter: string): unknown {
    // Simple implementation for demonstration
    // In full implementation, use a proper JMESPath library
    return data; // Pass-through for now
  }
}
