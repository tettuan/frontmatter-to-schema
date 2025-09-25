# ドメインアーキテクチャ設計 - Templateドメイン

## 概要

本書は、テンプレート管理とレンダリングを担うTemplateドメインのアーキテクチャを定義する。

### 最新の拡張

#### 中間表現層（IR）の統合

テンプレート変数解決の精度向上のため、以下の拡張を導入：

1. **TemplatePathSegment**: 配列ショートハンド（`@items`, `items[]`）をサポート
2. **中間表現層との統合**: [IRアーキテクチャ](./domain-architecture-intermediate-representation.md)と連携
3. **TemplateContext**: スコープ管理による正確な変数解決（[仕様](../../architecture/template-context-specification.md)参照）

## Templateドメインモデル

### 1. 値オブジェクト

```typescript
import { Result, ValidationError } from "../shared/types";

/**
 * テンプレートパス
 */
export class TemplatePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<TemplatePath, TemplatePathError> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyPath", message: "Template path cannot be empty" },
      };
    }

    // サポートされる拡張子
    const validExtensions = [
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".hbs",
      ".mustache",
    ];
    const hasValidExt = validExtensions.some((ext) =>
      path.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          path,
          validExtensions,
          message: `Template must have valid extension, got: ${path}`,
        },
      };
    }

    return { ok: true, data: new TemplatePath(path) };
  }

  toString(): string {
    return this.value;
  }

  getFormat(): TemplateFormat {
    const ext = this.value.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "json":
        return "json";
      case "yaml":
      case "yml":
        return "yaml";
      case "toml":
        return "toml";
      case "hbs":
      case "mustache":
        return "handlebars";
      default:
        return "json";
    }
  }
}

/**
 * テンプレート形式
 */
export type TemplateFormat = "json" | "yaml" | "toml" | "handlebars";

/**
 * 出力形式
 */
export type OutputFormat = "json" | "yaml" | "toml";

/**
 * テンプレート変数
 */
export class TemplateVariable {
  private constructor(
    private readonly name: string,
    private readonly path: string,
    private readonly required: boolean = false,
    private readonly defaultValue?: unknown,
  ) {}

  static create(
    name: string,
    options?: {
      path?: string;
      required?: boolean;
      defaultValue?: unknown;
    },
  ): Result<TemplateVariable, ValidationError> {
    if (!name || name.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Variable name cannot be empty" },
      };
    }

    // 変数名パターン検証
    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!pattern.test(name)) {
      return {
        ok: false,
        error: {
          kind: "PatternMismatch",
          value: name,
          pattern: pattern.source,
          message: "Variable name must be valid identifier",
        },
      };
    }

    return {
      ok: true,
      data: new TemplateVariable(
        name,
        options?.path || name,
        options?.required || false,
        options?.defaultValue,
      ),
    };
  }

  getName(): string {
    return this.name;
  }
  getPath(): string {
    return this.path;
  }
  isRequired(): boolean {
    return this.required;
  }
  getDefaultValue(): unknown {
    return this.defaultValue;
  }
}

/**
 * テンプレート変数パス
 * {variable.nested.path} 形式のパスを表現
 * 配列ショートハンド ({@items}, items[]) もサポート
 */
export class VariablePath {
  private constructor(
    private readonly segments: TemplatePathSegment[],
    private readonly raw: string,
  ) {}

  static parse(expression: string): Result<VariablePath, ParseError> {
    // {variable}, {variable.nested.path}, {@items}, {items[]} 形式
    const match = expression.match(/^\{([^}]+)\}$/);
    if (!match) {
      return {
        ok: false,
        error: {
          kind: "InvalidVariableExpression",
          expression,
          message: "Variable must be in {variable} format",
        },
      };
    }

    const path = match[1];
    const segments: TemplatePathSegment[] = [];

    // 特殊マーカーのチェック
    if (path.startsWith("@")) {
      segments.push({ kind: "array-marker", marker: path });
      return {
        ok: true,
        data: new VariablePath(segments, expression),
      };
    }

    // 配列インデックスと通常パスの解析
    const parts = path.split(".");
    for (const part of parts) {
      if (!part || part.trim().length === 0) {
        return {
          ok: false,
          error: {
            kind: "EmptySegment",
            path,
            message: "Variable path contains empty segment",
          },
        };
      }

      // 配列アクセス (e.g., items[0] or items[])
      const arrayMatch = part.match(/^([^[]+)\[(\d*)\]$/);
      if (arrayMatch) {
        segments.push({ kind: "property", name: arrayMatch[1] });
        if (arrayMatch[2]) {
          segments.push({ kind: "index", value: parseInt(arrayMatch[2], 10) });
        } else {
          segments.push({ kind: "array-marker", marker: `${arrayMatch[1]}[]` });
        }
      } else {
        segments.push({ kind: "property", name: part });
      }
    }

    return {
      ok: true,
      data: new VariablePath(segments, expression),
    };
  }

  getSegments(): TemplatePathSegment[] {
    return [...this.segments];
  }
  getRaw(): string {
    return this.raw;
  }

  resolve(data: Record<string, unknown>): Result<unknown, ResolutionError> {
    let current: any = data;

    for (const segment of this.segments) {
      if (current == null || typeof current !== "object") {
        return {
          ok: false,
          error: {
            kind: "PathNotFound",
            path: this.segments.join("."),
            segment,
            message: `Cannot resolve path at segment: ${segment}`,
          },
        };
      }

      if (!(segment in current)) {
        return {
          ok: false,
          error: {
            kind: "PropertyNotFound",
            path: this.segments.join("."),
            property: segment,
            message: `Property not found: ${segment}`,
          },
        };
      }

      current = current[segment];
    }

    return { ok: true, data: current };
  }
}

/**
 * レンダリング結果
 */
export class RenderedContent {
  private constructor(
    private readonly content: string,
    private readonly format: OutputFormat,
    private readonly metadata: RenderMetadata,
  ) {}

  static create(
    content: string,
    format: OutputFormat,
    metadata?: Partial<RenderMetadata>,
  ): Result<RenderedContent, ValidationError> {
    if (!content) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Rendered content cannot be empty",
        },
      };
    }

    const fullMetadata: RenderMetadata = {
      renderedAt: new Date(),
      variableCount: metadata?.variableCount || 0,
      templatePath: metadata?.templatePath,
      ...metadata,
    };

    return {
      ok: true,
      data: new RenderedContent(content, format, fullMetadata),
    };
  }

  getContent(): string {
    return this.content;
  }
  getFormat(): OutputFormat {
    return this.format;
  }
  getMetadata(): RenderMetadata {
    return { ...this.metadata };
  }
}

interface RenderMetadata {
  readonly renderedAt: Date;
  readonly variableCount: number;
  readonly templatePath?: string;
  readonly warnings?: string[];
}
```

### 2. エンティティ

```typescript
/**
 * テンプレートの状態
 */
export type TemplateState =
  | { kind: "Unloaded"; path: TemplatePath }
  | { kind: "Loading"; path: TemplatePath }
  | {
    kind: "Loaded";
    path: TemplatePath;
    content: string;
    format: TemplateFormat;
  }
  | { kind: "Parsed"; path: TemplatePath; template: ParsedTemplate }
  | { kind: "Compiled"; path: TemplatePath; compiled: CompiledTemplate }
  | { kind: "Failed"; path: TemplatePath; error: TemplateError };

/**
 * テンプレートエンティティ
 */
export class Template {
  private state: TemplateState;

  private constructor(
    private readonly id: TemplateId,
    initialPath: TemplatePath,
  ) {
    this.state = { kind: "Unloaded", path: initialPath };
  }

  static create(id: TemplateId, path: TemplatePath): Template {
    return new Template(id, path);
  }

  // 状態遷移メソッド
  load(content: string, format: TemplateFormat): Result<void, TemplateError> {
    switch (this.state.kind) {
      case "Unloaded":
      case "Failed":
        this.state = {
          kind: "Loaded",
          path: this.state.path,
          content,
          format,
        };
        return { ok: true, data: undefined };
      default:
        return {
          ok: false,
          error: {
            kind: "InvalidStateTransition",
            from: this.state.kind,
            to: "Loaded",
            message: `Cannot load template in state: ${this.state.kind}`,
          },
        };
    }
  }

  setParsed(parsed: ParsedTemplate): Result<void, TemplateError> {
    if (this.state.kind !== "Loaded") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Parsed",
          message: `Cannot parse from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Parsed",
      path: this.state.path,
      template: parsed,
    };

    return { ok: true, data: undefined };
  }

  setCompiled(compiled: CompiledTemplate): Result<void, TemplateError> {
    if (this.state.kind !== "Parsed") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Compiled",
          message: `Cannot compile from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Compiled",
      path: this.state.path,
      compiled,
    };

    return { ok: true, data: undefined };
  }

  fail(error: TemplateError): void {
    this.state = {
      kind: "Failed",
      path: this.getPath(),
      error,
    };
  }

  // クエリメソッド
  getId(): TemplateId {
    return this.id;
  }

  getPath(): TemplatePath {
    return this.state.path;
  }

  getState(): TemplateState {
    return this.state;
  }

  isCompiled(): boolean {
    return this.state.kind === "Compiled";
  }

  getCompiledTemplate(): Result<CompiledTemplate, TemplateError> {
    if (this.state.kind !== "Compiled") {
      return {
        ok: false,
        error: {
          kind: "NotCompiled",
          state: this.state.kind,
          message:
            `Template is not compiled, current state: ${this.state.kind}`,
        },
      };
    }

    return { ok: true, data: this.state.compiled };
  }
}

/**
 * テンプレートID
 */
export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<TemplateId, ValidationError> {
    if (!value || value.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Template ID cannot be empty" },
      };
    }

    return { ok: true, data: new TemplateId(value) };
  }

  static fromPath(path: TemplatePath): TemplateId {
    const id = path.toString()
      .replace(/[\/\\]/g, "_")
      .replace(/\.[^.]+$/, "");
    return new TemplateId(id);
  }

  equals(other: TemplateId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * パース済みテンプレート
 */
export interface ParsedTemplate {
  readonly content: string;
  readonly variables: TemplateVariable[];
  readonly format: TemplateFormat;
  readonly outputFormat: OutputFormat;
}

/**
 * コンパイル済みテンプレート
 */
export interface CompiledTemplate {
  readonly id: TemplateId;
  readonly render: (
    data: Record<string, unknown>,
  ) => Result<string, RenderError>;
  readonly variables: TemplateVariable[];
  readonly outputFormat: OutputFormat;
}
```

### 3. ドメインサービス

```typescript
/**
 * テンプレート解析サービス
 */
export class TemplateParser {
  parse(
    content: string,
    format: TemplateFormat,
  ): Result<ParsedTemplate, ParseError> {
    // 変数抽出
    const variablesResult = this.extractVariables(content);
    if (!variablesResult.ok) return variablesResult;

    // 出力形式の決定
    const outputFormat = this.detectOutputFormat(content, format);

    return {
      ok: true,
      data: {
        content,
        variables: variablesResult.data,
        format,
        outputFormat,
      },
    };
  }

  private extractVariables(
    content: string,
  ): Result<TemplateVariable[], ParseError> {
    const variables: TemplateVariable[] = [];
    const seen = new Set<string>();

    // {variable} パターンの抽出
    const pattern = /\{([^}]+)\}/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const varPath = match[1];

      if (seen.has(varPath)) {
        continue;
      }
      seen.add(varPath);

      const varName = varPath.split(".")[0];
      const varResult = TemplateVariable.create(varName, {
        path: varPath,
        required: true,
      });

      if (!varResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidVariable",
            variable: varPath,
            message: `Invalid variable: ${varPath}`,
          },
        };
      }

      variables.push(varResult.data);
    }

    return { ok: true, data: variables };
  }

  private detectOutputFormat(
    content: string,
    format: TemplateFormat,
  ): OutputFormat {
    // Template形式から出力形式を推定
    switch (format) {
      case "yaml":
        return "yaml";
      case "toml":
        return "toml";
      case "json":
      case "handlebars":
      default:
        return "json";
    }
  }
}

/**
 * テンプレートコンパイラー
 */
export class TemplateCompiler {
  compile(parsed: ParsedTemplate): Result<CompiledTemplate, CompileError> {
    const compiledFunc = this.createRenderFunction(parsed);

    return {
      ok: true,
      data: {
        id: TemplateId.create(`compiled_${Date.now()}`).data as TemplateId,
        render: compiledFunc,
        variables: parsed.variables,
        outputFormat: parsed.outputFormat,
      },
    };
  }

  private createRenderFunction(
    parsed: ParsedTemplate,
  ): (data: Record<string, unknown>) => Result<string, RenderError> {
    return (data: Record<string, unknown>) => {
      let result = parsed.content;
      const warnings: string[] = [];

      for (const variable of parsed.variables) {
        const varPath = VariablePath.parse(`{${variable.getPath()}}`);
        if (!varPath.ok) {
          return {
            ok: false,
            error: {
              kind: "RenderFailed",
              reason: "Invalid variable path",
              variable: variable.getPath(),
              message: varPath.error.message,
            },
          };
        }

        const valueResult = varPath.data.resolve(data);
        let value: unknown;

        if (!valueResult.ok) {
          if (variable.isRequired()) {
            return {
              ok: false,
              error: {
                kind: "RequiredVariableMissing",
                variable: variable.getName(),
                path: variable.getPath(),
                message: `Required variable not found: ${variable.getPath()}`,
              },
            };
          }

          value = variable.getDefaultValue();
          warnings.push(`Using default value for ${variable.getPath()}`);
        } else {
          value = valueResult.data;
        }

        // 値のフォーマット
        const formatted = this.formatValue(value, parsed.outputFormat);

        // 変数置換
        const placeholder = `{${variable.getPath()}}`;
        result = result.replace(
          new RegExp(
            placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "g",
          ),
          formatted,
        );
      }

      return { ok: true, data: result };
    };
  }

  private formatValue(value: unknown, format: OutputFormat): string {
    if (value === null) return "null";
    if (value === undefined) return "";

    switch (format) {
      case "json":
        return typeof value === "string" ? value : JSON.stringify(value);
      case "yaml":
        return this.formatYAMLValue(value);
      case "toml":
        return this.formatTOMLValue(value);
      default:
        return String(value);
    }
  }

  private formatYAMLValue(value: unknown): string {
    // YAML値フォーマット実装
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatTOMLValue(value: unknown): string {
    // TOML値フォーマット実装
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

/**
 * テンプレートレンダラー
 */
export class TemplateRenderer {
  render(
    template: CompiledTemplate,
    data: Record<string, unknown>,
  ): Result<RenderedContent, RenderError> {
    const renderResult = template.render(data);
    if (!renderResult.ok) return renderResult;

    return RenderedContent.create(
      renderResult.data,
      template.outputFormat,
      {
        variableCount: template.variables.length,
        templatePath: template.id.toString(),
      },
    );
  }
}
```

### 4. リポジトリインターフェース

```typescript
/**
 * テンプレートリポジトリ
 */
export interface TemplateRepository {
  load(path: TemplatePath): Promise<Result<Template, TemplateError>>;
  save(template: Template): Promise<Result<void, TemplateError>>;
  findById(id: TemplateId): Promise<Result<Template | null, TemplateError>>;
  findByFormat(
    format: TemplateFormat,
  ): Promise<Result<Template[], TemplateError>>;
}
```

### 5. エラー型定義

```typescript
/**
 * Template path segment types for enhanced path resolution
 */
export type TemplatePathSegment =
  | { kind: "property"; name: string }
  | { kind: "index"; value: number }
  | { kind: "array-marker"; marker: string }; // @items, items[]

export type TemplateError =
  | TemplatePathError
  | ParseError
  | CompileError
  | RenderError
  | StateError;

export type TemplatePathError =
  | { kind: "EmptyPath"; message: string }
  | {
    kind: "InvalidExtension";
    path: string;
    validExtensions: string[];
    message: string;
  }
  | { kind: "FileNotFound"; path: string; message: string };

export type ParseError =
  | { kind: "InvalidVariable"; variable: string; message: string }
  | { kind: "InvalidVariableExpression"; expression: string; message: string }
  | { kind: "EmptySegment"; path: string; message: string };

export type CompileError = {
  kind: "CompilationFailed";
  reason: string;
  message: string;
};

export type RenderError =
  | { kind: "RenderFailed"; reason: string; variable?: string; message: string }
  | {
    kind: "RequiredVariableMissing";
    variable: string;
    path: string;
    message: string;
  }
  | ResolutionError;

export type ResolutionError =
  | { kind: "PathNotFound"; path: string; segment: string; message: string }
  | {
    kind: "PropertyNotFound";
    path: string;
    property: string;
    message: string;
  };

export type StateError =
  | {
    kind: "InvalidStateTransition";
    from: string;
    to: string;
    message: string;
  }
  | { kind: "NotCompiled"; state: string; message: string };
```
