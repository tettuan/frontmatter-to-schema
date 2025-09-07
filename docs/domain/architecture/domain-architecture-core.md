# ドメインアーキテクチャ設計 - コアドメイン

## 概要

本書は、Markdown FrontMatterからSchemaベースでの構造化データ変換システムにおけるコアドメインのアーキテクチャを定義する。
全域性原則に基づき、型安全で拡張可能な設計を実現する。

## コアドメインモデル

### 1. Schema領域

```typescript
// ========================================
// 値オブジェクト（全域性原則適用）
// ========================================

/**
 * Schemaファイルへのパス
 * Smart Constructor適用による制約保証
 */
export class SchemaPath {
  private constructor(private readonly value: string) {}
  
  static create(path: string): Result<SchemaPath, SchemaPathError> {
    // 空文字チェック
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyPath", message: "Schema path cannot be empty" }
      };
    }
    
    // 拡張子チェック
    if (!path.endsWith('.json')) {
      return {
        ok: false,
        error: { 
          kind: "InvalidExtension", 
          path,
          message: `Schema file must be .json, got: ${path}`
        }
      };
    }
    
    // パス正規化
    const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    
    return { ok: true, data: new SchemaPath(normalized) };
  }
  
  toString(): string { return this.value; }
  
  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf('/');
    return lastSlash === -1 ? '.' : this.value.substring(0, lastSlash);
  }
  
  getFileName(): string {
    const lastSlash = this.value.lastIndexOf('/');
    return lastSlash === -1 ? this.value : this.value.substring(lastSlash + 1);
  }
}

/**
 * Schema ID（識別子）
 */
export class SchemaId {
  private constructor(private readonly value: string) {}
  
  static create(id: string): Result<SchemaId, ValidationError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Schema ID cannot be empty" }
      };
    }
    
    // 有効な識別子パターン
    const pattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!pattern.test(id)) {
      return {
        ok: false,
        error: {
          kind: "PatternMismatch",
          value: id,
          pattern: pattern.source,
          message: "Schema ID must start with letter and contain only alphanumeric, underscore, or hyphen"
        }
      };
    }
    
    return { ok: true, data: new SchemaId(id) };
  }
  
  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }
  
  toString(): string { return this.value; }
}

// ========================================
// エンティティ
// ========================================

/**
 * Schema定義の状態（Discriminated Union）
 */
export type SchemaState =
  | { kind: "Unloaded"; path: SchemaPath }
  | { kind: "Loading"; path: SchemaPath }
  | { kind: "Raw"; path: SchemaPath; content: RawSchema }
  | { kind: "Resolving"; path: SchemaPath; schema: RawSchema; refs: SchemaReference[] }
  | { kind: "Resolved"; path: SchemaPath; schema: ResolvedSchema; metadata: SchemaMetadata }
  | { kind: "Failed"; path: SchemaPath; error: SchemaError };

/**
 * Schemaエンティティ
 */
export class Schema {
  private state: SchemaState;
  
  private constructor(
    private readonly id: SchemaId,
    initialState: SchemaState
  ) {
    this.state = initialState;
  }
  
  static create(id: SchemaId, path: SchemaPath): Schema {
    return new Schema(id, { kind: "Unloaded", path });
  }
  
  // 状態遷移メソッド（全域性保証）
  load(content: RawSchema): Result<void, SchemaError> {
    switch (this.state.kind) {
      case "Unloaded":
      case "Failed":
        this.state = { kind: "Raw", path: this.state.path, content };
        return { ok: true, data: undefined };
      default:
        return {
          ok: false,
          error: {
            kind: "InvalidStateTransition",
            from: this.state.kind,
            to: "Raw",
            message: `Cannot load schema in state: ${this.state.kind}`
          }
        };
    }
  }
  
  startResolving(refs: SchemaReference[]): Result<void, SchemaError> {
    if (this.state.kind !== "Raw") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Resolving",
          message: `Cannot start resolving from state: ${this.state.kind}`
        }
      };
    }
    
    this.state = {
      kind: "Resolving",
      path: this.state.path,
      schema: this.state.content,
      refs
    };
    
    return { ok: true, data: undefined };
  }
  
  complete(resolved: ResolvedSchema, metadata: SchemaMetadata): Result<void, SchemaError> {
    if (this.state.kind !== "Resolving") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Resolved",
          message: `Cannot complete from state: ${this.state.kind}`
        }
      };
    }
    
    this.state = {
      kind: "Resolved",
      path: this.state.path,
      schema: resolved,
      metadata
    };
    
    return { ok: true, data: undefined };
  }
  
  fail(error: SchemaError): void {
    this.state = { kind: "Failed", path: this.getPath(), error };
  }
  
  // クエリメソッド
  getId(): SchemaId { return this.id; }
  
  getPath(): SchemaPath {
    return this.state.path;
  }
  
  getState(): SchemaState { return this.state; }
  
  isResolved(): boolean {
    return this.state.kind === "Resolved";
  }
  
  getResolvedSchema(): Result<ResolvedSchema, SchemaError> {
    if (this.state.kind !== "Resolved") {
      return {
        ok: false,
        error: {
          kind: "SchemaNotResolved",
          state: this.state.kind,
          message: `Schema is not resolved, current state: ${this.state.kind}`
        }
      };
    }
    
    return { ok: true, data: this.state.schema };
  }
}

// ========================================
// ドメインサービス
// ========================================

/**
 * Schema参照解決サービス
 */
export class SchemaReferenceResolver {
  private cache = new Map<string, ResolvedSchema>();
  
  async resolve(
    schema: RawSchema,
    basePath: string
  ): Promise<Result<ResolvedSchema, SchemaError>> {
    // 循環参照検出
    const visited = new Set<string>();
    
    const resolveRecursive = async (
      obj: any,
      currentPath: string,
      depth: number = 0
    ): Promise<Result<any, SchemaError>> => {
      // 深さ制限
      if (depth > 100) {
        return {
          ok: false,
          error: {
            kind: "MaxDepthExceeded",
            depth,
            message: "Maximum reference resolution depth exceeded"
          }
        };
      }
      
      // プリミティブ値はそのまま返す
      if (typeof obj !== 'object' || obj === null) {
        return { ok: true, data: obj };
      }
      
      // $ref処理
      if ('$ref' in obj) {
        const refPath = obj['$ref'] as string;
        
        // 循環参照チェック
        if (visited.has(refPath)) {
          return {
            ok: false,
            error: {
              kind: "CircularReference",
              refs: Array.from(visited).concat(refPath),
              message: `Circular reference detected: ${refPath}`
            }
          };
        }
        
        visited.add(refPath);
        
        // キャッシュチェック
        if (this.cache.has(refPath)) {
          return { ok: true, data: this.cache.get(refPath) };
        }
        
        // 参照先を読み込み
        const loadResult = await this.loadReference(refPath, currentPath);
        if (!loadResult.ok) return loadResult;
        
        // 再帰的に解決
        const resolvedResult = await resolveRecursive(
          loadResult.data,
          this.getReferencePath(refPath, currentPath),
          depth + 1
        );
        
        visited.delete(refPath);
        
        if (resolvedResult.ok) {
          this.cache.set(refPath, resolvedResult.data);
        }
        
        return resolvedResult;
      }
      
      // 配列の処理
      if (Array.isArray(obj)) {
        const results: any[] = [];
        for (const item of obj) {
          const result = await resolveRecursive(item, currentPath, depth);
          if (!result.ok) return result;
          results.push(result.data);
        }
        return { ok: true, data: results };
      }
      
      // オブジェクトの処理
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const result = await resolveRecursive(value, currentPath, depth);
        if (!result.ok) return result;
        resolved[key] = result.data;
      }
      
      return { ok: true, data: resolved };
    };
    
    return resolveRecursive(schema, basePath, 0);
  }
  
  private async loadReference(
    refPath: string,
    basePath: string
  ): Promise<Result<any, SchemaError>> {
    // 実装は Infrastructure層で提供
    throw new Error("Must be implemented by infrastructure layer");
  }
  
  private getReferencePath(refPath: string, basePath: string): string {
    if (refPath.startsWith('/')) {
      return refPath;
    }
    return `${basePath}/${refPath}`.replace(/\/+/g, '/');
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}

// ========================================
// リポジトリインターフェース
// ========================================

export interface SchemaRepository {
  load(path: SchemaPath): Promise<Result<Schema, SchemaError>>;
  save(schema: Schema): Promise<Result<void, SchemaError>>;
  findById(id: SchemaId): Promise<Result<Schema | null, SchemaError>>;
  exists(path: SchemaPath): Promise<Result<boolean, SchemaError>>;
}

// ========================================
// エラー型定義
// ========================================

export type SchemaError =
  | SchemaPathError
  | SchemaLoadError
  | SchemaResolutionError
  | SchemaValidationError;

export type SchemaPathError =
  | { kind: "EmptyPath"; message: string }
  | { kind: "InvalidExtension"; path: string; message: string }
  | { kind: "FileNotFound"; path: string; message: string };

export type SchemaLoadError =
  | { kind: "InvalidJSON"; path: string; error: string; message: string }
  | { kind: "ReadError"; path: string; error: string; message: string };

export type SchemaResolutionError =
  | { kind: "CircularReference"; refs: string[]; message: string }
  | { kind: "MaxDepthExceeded"; depth: number; message: string }
  | { kind: "RefResolutionFailed"; ref: string; error: string; message: string };

export type SchemaValidationError =
  | { kind: "InvalidStateTransition"; from: string; to: string; message: string }
  | { kind: "SchemaNotResolved"; state: string; message: string }
  | { kind: "ValidationFailed"; errors: any[]; message: string };
```

### 2. SchemaメタデータとTemplate関連

```typescript
/**
 * Schemaメタデータ
 */
export interface SchemaMetadata {
  readonly templatePath?: string;
  readonly frontmatterPart?: boolean;
  readonly derivationRules?: DerivationRule[];
  readonly validationOptions?: ValidationOptions;
}

/**
 * 派生ルール定義
 */
export class DerivationRule {
  private constructor(
    private readonly targetField: string,
    private readonly sourceExpression: string,
    private readonly unique: boolean = false
  ) {}
  
  static create(
    target: string,
    source: string,
    unique?: boolean
  ): Result<DerivationRule, ValidationError> {
    if (!target || target.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Target field cannot be empty" }
      };
    }
    
    if (!source || source.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Source expression cannot be empty" }
      };
    }
    
    // JSONPath式の基本検証
    if (!source.includes('[') && !source.includes('.')) {
      return {
        ok: false,
        error: {
          kind: "InvalidExpression",
          expression: source,
          message: "Source expression must be a valid JSONPath"
        }
      };
    }
    
    return {
      ok: true,
      data: new DerivationRule(target, source, unique ?? false)
    };
  }
  
  getTargetField(): string { return this.targetField; }
  getSourceExpression(): string { return this.sourceExpression; }
  isUnique(): boolean { return this.unique; }
}

/**
 * 検証オプション
 */
export interface ValidationOptions {
  readonly strict: boolean;
  readonly allowAdditionalProperties: boolean;
  readonly coerceTypes?: boolean;
  readonly removeAdditional?: boolean;
}
```