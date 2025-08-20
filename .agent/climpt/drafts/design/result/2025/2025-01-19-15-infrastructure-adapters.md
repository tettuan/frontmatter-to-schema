# インフラストラクチャ層設計 - アダプター実装

## 1. ファイルシステムアダプター

### 1.1 Denoファイルシステムアダプター

```typescript
import { Result, DomainError, createDomainError } from "../../domain/domain-core-types";
import { FilePath, FilePattern, MarkdownContent } from "../../domain/domain-core-types";
import { FileDiscoveryService } from "../../domain/domain-services";

// Denoファイルシステムアダプター
export class DenoFileSystemAdapter implements FileDiscoveryService {
  async discover(patterns: readonly FilePattern[]): Promise<Result<readonly FilePath[], DomainError>> {
    try {
      const allFiles: FilePath[] = [];
      
      for (const pattern of patterns) {
        const matches = await this.globFiles(pattern.getValue());
        
        for (const match of matches) {
          const pathResult = FilePath.create(match);
          if (pathResult.ok) {
            allFiles.push(pathResult.data);
          }
        }
      }
      
      return { ok: true, data: allFiles };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `File discovery failed: ${error}` 
        })
      };
    }
  }
  
  async exists(path: FilePath): Promise<Result<boolean, DomainError>> {
    try {
      const fileInfo = await Deno.stat(path.getValue());
      return { ok: true, data: fileInfo.isFile };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `File check failed: ${error}` 
        })
      };
    }
  }
  
  async readContent(path: FilePath): Promise<Result<MarkdownContent, DomainError>> {
    try {
      const content = await Deno.readTextFile(path.getValue());
      return MarkdownContent.create(content);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError("FileNotFound", { path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `File read failed: ${error}` 
        })
      };
    }
  }
  
  private async globFiles(pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    // Denoのglob実装
    for await (const entry of Deno.readDir(".")) {
      if (entry.isFile && this.matchPattern(entry.name, pattern)) {
        files.push(entry.name);
      }
    }
    
    return files;
  }
  
  private matchPattern(filename: string, pattern: string): boolean {
    // 簡易的なパターンマッチング（実際はもっと複雑）
    const regexPattern = pattern
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
  }
}
```

### 1.2 ファイル書き込みアダプター

```typescript
import { OutputFormat } from "../../domain/domain-core-types";

// ファイル書き込みアダプター
export class FileWriterAdapter {
  async write(
    path: FilePath,
    content: unknown,
    format: OutputFormat
  ): Promise<Result<void, DomainError>> {
    try {
      const formatted = this.formatContent(content, format);
      await Deno.writeTextFile(path.getValue(), formatted);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `File write failed: ${error}` 
        })
      };
    }
  }
  
  private formatContent(content: unknown, format: OutputFormat): string {
    switch (format.getValue()) {
      case "json":
        return JSON.stringify(content, null, 2);
      case "yaml":
        return this.toYAML(content);
      case "xml":
        return this.toXML(content);
      default:
        return String(content);
    }
  }
  
  private toYAML(content: unknown): string {
    // YAML変換実装（ライブラリ使用）
    // 簡易実装
    return JSON.stringify(content, null, 2);
  }
  
  private toXML(content: unknown): string {
    // XML変換実装（ライブラリ使用）
    // 簡易実装
    return `<?xml version="1.0"?>\n<root>${JSON.stringify(content)}</root>`;
  }
}
```

## 2. 設定ローダーアダプター

### 2.1 JSON設定ローダー

```typescript
import { ExecutionConfig } from "../../domain/domain-core-types";

// 設定ローダーインターフェース
export interface ConfigurationLoader {
  load(path: string): Promise<Result<ExecutionConfig, DomainError>>;
}

// JSON設定ローダー実装
export class JSONConfigurationLoader implements ConfigurationLoader {
  async load(path: string): Promise<Result<ExecutionConfig, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      const rawConfig = JSON.parse(content);
      
      // バリデーションと変換
      if (!this.validateConfig(rawConfig)) {
        return {
          ok: false,
          error: createDomainError("InvalidConfiguration", { field: "config" })
        };
      }
      
      return ExecutionConfig.create({
        schemaPath: rawConfig.schemaPath,
        templatePath: rawConfig.templatePath,
        inputPath: rawConfig.inputPath,
        outputPath: rawConfig.outputPath,
        outputFormat: rawConfig.outputFormat
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          ok: false,
          error: createDomainError("ParseError", { input: path })
        };
      }
      return {
        ok: false,
        error: createDomainError("FileNotFound", { path })
      };
    }
  }
  
  private validateConfig(config: unknown): config is RawConfig {
    if (typeof config !== "object" || config === null) {
      return false;
    }
    
    const c = config as Record<string, unknown>;
    return (
      typeof c.schemaPath === "string" &&
      typeof c.templatePath === "string" &&
      typeof c.inputPath === "string" &&
      typeof c.outputPath === "string" &&
      typeof c.outputFormat === "string"
    );
  }
}

// 生の設定型
interface RawConfig {
  schemaPath: string;
  templatePath: string;
  inputPath: string;
  outputPath: string;
  outputFormat: string;
}
```

### 2.2 Schemaレジストリアダプター

```typescript
// Schemaレジストリ
export interface SchemaRegistry {
  register(name: string, config: ExecutionConfig): Promise<Result<void, DomainError>>;
  getConfig(name: string): Promise<Result<ExecutionConfig, DomainError>>;
  listSchemas(): Promise<string[]>;
}

// Schemaレジストリ実装
export class FileBasedSchemaRegistry implements SchemaRegistry {
  private readonly registryPath = ".schemas/registry.json";
  private cache = new Map<string, ExecutionConfig>();
  
  async register(name: string, config: ExecutionConfig): Promise<Result<void, DomainError>> {
    try {
      // レジストリ読み込み
      const registry = await this.loadRegistry();
      
      // 設定を保存
      registry[name] = {
        schemaPath: config.getSchemaPath().getValue(),
        templatePath: config.getTemplatePath().getValue(),
        inputPath: config.getInputPath().getValue(),
        outputPath: config.getOutputPath().getValue(),
        outputFormat: config.getOutputFormat().getValue()
      };
      
      // レジストリ書き込み
      await Deno.writeTextFile(this.registryPath, JSON.stringify(registry, null, 2));
      
      // キャッシュ更新
      this.cache.set(name, config);
      
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `Registry update failed: ${error}` 
        })
      };
    }
  }
  
  async getConfig(name: string): Promise<Result<ExecutionConfig, DomainError>> {
    // キャッシュチェック
    if (this.cache.has(name)) {
      return { ok: true, data: this.cache.get(name)! };
    }
    
    try {
      const registry = await this.loadRegistry();
      
      if (!(name in registry)) {
        return {
          ok: false,
          error: createDomainError("InvalidConfiguration", { field: `schema:${name}` })
        };
      }
      
      const rawConfig = registry[name];
      const config = await ExecutionConfig.create(rawConfig);
      
      if (config.ok) {
        this.cache.set(name, config.data);
      }
      
      return config;
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `Registry read failed: ${error}` 
        })
      };
    }
  }
  
  async listSchemas(): Promise<string[]> {
    try {
      const registry = await this.loadRegistry();
      return Object.keys(registry);
    } catch {
      return [];
    }
  }
  
  private async loadRegistry(): Promise<Record<string, RawConfig>> {
    try {
      const content = await Deno.readTextFile(this.registryPath);
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}
```

## 3. AI分析アダプター

### 3.1 Claude APIアダプター

```typescript
import { AIAnalysisService } from "../../domain/domain-services";

// Claude API設定
interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Claude APIアダプター
export class ClaudeAPIAdapter implements AIAnalysisService {
  private readonly config: ClaudeConfig;
  
  constructor(config: ClaudeConfig) {
    this.config = config;
  }
  
  async analyzeWithSchema(
    content: string,
    schema: unknown,
    prompt: string
  ): Promise<Result<unknown, DomainError>> {
    try {
      const systemPrompt = this.buildSystemPrompt(schema, prompt);
      const response = await this.callClaudeAPI(systemPrompt, content);
      
      // レスポンス解析
      const parsed = this.parseResponse(response);
      return { ok: true, data: parsed };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `Claude analysis failed: ${error}` 
        })
      };
    }
  }
  
  async mapWithTemplate(
    data: unknown,
    template: unknown,
    prompt: string
  ): Promise<Result<unknown, DomainError>> {
    try {
      const systemPrompt = this.buildMappingPrompt(template, prompt);
      const userPrompt = JSON.stringify(data, null, 2);
      const response = await this.callClaudeAPI(systemPrompt, userPrompt);
      
      // レスポンス解析
      const parsed = this.parseResponse(response);
      return { ok: true, data: parsed };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("MappingFailed", { 
          reason: `Claude mapping failed: ${error}` 
        })
      };
    }
  }
  
  private buildSystemPrompt(schema: unknown, prompt: string): string {
    return `
You are a data extraction assistant. Extract information from the provided content according to this schema:

${JSON.stringify(schema, null, 2)}

Additional instructions:
${prompt}

Return the extracted data as valid JSON.
    `.trim();
  }
  
  private buildMappingPrompt(template: unknown, prompt: string): string {
    return `
You are a data mapping assistant. Map the provided data to this template structure:

${JSON.stringify(template, null, 2)}

Additional instructions:
${prompt}

Return the mapped data as valid JSON.
    `.trim();
  }
  
  private async callClaudeAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  private parseResponse(response: string): unknown {
    // JSONレスポンスを抽出して解析
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // 直接JSONとして解析を試みる
    try {
      return JSON.parse(response);
    } catch {
      // 文字列として返す
      return response;
    }
  }
}
```

### 3.2 モックAIアダプター（テスト用）

```typescript
// モックAIアダプター
export class MockAIAdapter implements AIAnalysisService {
  private readonly responses = new Map<string, unknown>();
  
  setResponse(key: string, response: unknown): void {
    this.responses.set(key, response);
  }
  
  async analyzeWithSchema(
    content: string,
    schema: unknown,
    prompt: string
  ): Promise<Result<unknown, DomainError>> {
    const key = this.generateKey(content, schema);
    const response = this.responses.get(key) || this.generateMockResponse(schema);
    return { ok: true, data: response };
  }
  
  async mapWithTemplate(
    data: unknown,
    template: unknown,
    prompt: string
  ): Promise<Result<unknown, DomainError>> {
    const key = this.generateKey(data, template);
    const response = this.responses.get(key) || this.generateMockMapping(template);
    return { ok: true, data: response };
  }
  
  private generateKey(input: unknown, context: unknown): string {
    return `${JSON.stringify(input)}-${JSON.stringify(context)}`;
  }
  
  private generateMockResponse(schema: unknown): unknown {
    // スキーマに基づいてモックデータを生成
    return {
      title: "Mock Title",
      description: "Mock Description",
      tags: ["mock", "test"],
      metadata: {
        author: "Test Author",
        date: new Date().toISOString()
      }
    };
  }
  
  private generateMockMapping(template: unknown): unknown {
    // テンプレートに基づいてモックデータを生成
    return {
      id: "mock-id",
      name: "Mock Name",
      values: [1, 2, 3]
    };
  }
}
```

## 4. YAMLパーサーアダプター

### 4.1 YAMLパーサー実装

```typescript
// YAMLパーサーアダプター
export class YAMLParserAdapter {
  parse(content: string): Result<Record<string, unknown>, DomainError> {
    try {
      // 実際はyamlライブラリを使用
      // import { parse } from "https://deno.land/std/yaml/mod.ts";
      // const parsed = parse(content);
      
      // 簡易実装（実際はライブラリ使用）
      const parsed = this.simpleYAMLParse(content);
      return { ok: true, data: parsed };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ParseError", { input: `YAML parse error: ${error}` })
      };
    }
  }
  
  stringify(data: Record<string, unknown>): Result<string, DomainError> {
    try {
      // 実際はyamlライブラリを使用
      // import { stringify } from "https://deno.land/std/yaml/mod.ts";
      // const yaml = stringify(data);
      
      // 簡易実装
      const yaml = this.simpleYAMLStringify(data);
      return { ok: true, data: yaml };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", { 
          step: `YAML stringify error: ${error}` 
        })
      };
    }
  }
  
  private simpleYAMLParse(content: string): Record<string, unknown> {
    // 非常に簡易的なYAMLパーサー（実際はライブラリ使用）
    const result: Record<string, unknown> = {};
    const lines = content.split("\n");
    
    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":").map(s => s.trim());
        result[key] = this.parseValue(value);
      }
    }
    
    return result;
  }
  
  private simpleYAMLStringify(data: Record<string, unknown>): string {
    // 簡易的なYAML文字列化
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "object" && value !== null) {
        lines.push(`${key}:`);
        // ネストしたオブジェクトの処理（簡略化）
        lines.push(`  ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    
    return lines.join("\n");
  }
  
  private parseValue(value: string): unknown {
    // 値の解析
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }
}
```

## 5. ロギングアダプター

### 5.1 構造化ログアダプター

```typescript
// ログレベル
export type LogLevel = "debug" | "info" | "warn" | "error";

// ロガーインターフェース
export interface Logger {
  log(level: LogLevel, message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

// 構造化ログアダプター
export class StructuredLogger implements Logger {
  private readonly minLevel: LogLevel;
  
  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }
  
  log(level: LogLevel, message: string, context?: unknown): void {
    if (!this.shouldLog(level)) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      pid: Deno.pid
    };
    
    this.output(level, logEntry);
  }
  
  debug(message: string, context?: unknown): void {
    this.log("debug", message, context);
  }
  
  info(message: string, context?: unknown): void {
    this.log("info", message, context);
  }
  
  warn(message: string, context?: unknown): void {
    this.log("warn", message, context);
  }
  
  error(message: string, context?: unknown): void {
    this.log("error", message, context);
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }
  
  private output(level: LogLevel, entry: unknown): void {
    const json = JSON.stringify(entry);
    
    if (level === "error") {
      console.error(json);
    } else if (level === "warn") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }
}
```

## 6. 環境変数アダプター

### 6.1 環境設定アダプター

```typescript
// 環境変数アダプター
export class EnvironmentAdapter {
  get(key: string): string | undefined {
    return Deno.env.get(key);
  }
  
  getOrDefault(key: string, defaultValue: string): string {
    return Deno.env.get(key) || defaultValue;
  }
  
  getRequired(key: string): Result<string, DomainError> {
    const value = Deno.env.get(key);
    if (!value) {
      return {
        ok: false,
        error: createDomainError("InvalidConfiguration", { field: `env:${key}` })
      };
    }
    return { ok: true, data: value };
  }
  
  getAll(): Record<string, string> {
    return Deno.env.toObject();
  }
}

// アプリケーション設定
export class ApplicationConfiguration {
  constructor(private readonly env: EnvironmentAdapter) {}
  
  getClaudeAPIKey(): Result<string, DomainError> {
    return this.env.getRequired("CLAUDE_API_KEY");
  }
  
  getClaudeModel(): string {
    return this.env.getOrDefault("CLAUDE_MODEL", "claude-3-opus-20240229");
  }
  
  getMaxTokens(): number {
    const value = this.env.getOrDefault("CLAUDE_MAX_TOKENS", "4096");
    return parseInt(value, 10);
  }
  
  getTemperature(): number {
    const value = this.env.getOrDefault("CLAUDE_TEMPERATURE", "0");
    return parseFloat(value);
  }
  
  getLogLevel(): LogLevel {
    const value = this.env.getOrDefault("LOG_LEVEL", "info");
    if (["debug", "info", "warn", "error"].includes(value)) {
      return value as LogLevel;
    }
    return "info";
  }
  
  getSchemaRegistryPath(): string {
    return this.env.getOrDefault("SCHEMA_REGISTRY_PATH", ".schemas/registry.json");
  }
}
```

## まとめ

このインフラストラクチャ層により：

1. **外部依存の抽象化**: ファイルシステム、AI API、YAMLパーサーなどを抽象化
2. **Schema可変性対応**: 設定ローダーとレジストリによる動的Schema管理
3. **テスタビリティ**: モックアダプターによるテスト容易性
4. **エラーハンドリング**: 統一的なResult型によるエラー処理
5. **環境依存の分離**: 環境変数アダプターによる設定管理

全域性原則に従い、すべてのアダプターがResult型を返し、型安全性を保ちながら外部システムとの統合を実現しています。