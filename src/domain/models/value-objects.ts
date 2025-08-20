// Value objects with smart constructors following totality principle

import {
  createError,
  type Result,
  type ValidationError,
} from "../shared/types.ts";

// Document-related value objects
export class DocumentPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<DocumentPath, ValidationError & { message: string }> {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }

    if (!trimmedPath.endsWith(".md") && !trimmedPath.endsWith(".markdown")) {
      return {
        ok: false,
        error: createError({
          kind: "InvalidFormat",
          format: "*.md or *.markdown",
          input: trimmedPath,
        }),
      };
    }

    return { ok: true, data: new DocumentPath(trimmedPath) };
  }

  getValue(): string {
    return this.value;
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash > 0 ? this.value.substring(0, lastSlash) : ".";
  }

  getFilename(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash >= 0 ? this.value.substring(lastSlash + 1) : this.value;
  }
}

export class FrontMatterContent {
  private constructor(private readonly value: string) {}

  static create(
    content: string,
  ): Result<FrontMatterContent, ValidationError & { message: string }> {
    // Allow empty content for frontmatter (documents may have empty frontmatter)
    return { ok: true, data: new FrontMatterContent(content) };
  }

  getValue(): string {
    return this.value;
  }

  toJSON(): unknown {
    try {
      return JSON.parse(this.value);
    } catch {
      return null;
    }
  }
}

export class DocumentContent {
  private constructor(private readonly value: string) {}

  static create(
    content: string,
  ): Result<DocumentContent, ValidationError & { message: string }> {
    return { ok: true, data: new DocumentContent(content) };
  }

  getValue(): string {
    return this.value;
  }

  getLines(): string[] {
    return this.value.split("\n");
  }
}

// Configuration-related value objects
export class ConfigPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<ConfigPath, ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }
    // Validate config file extensions
    if (
      !path.endsWith(".json") && !path.endsWith(".yaml") &&
      !path.endsWith(".yml") && !path.endsWith(".toml")
    ) {
      return {
        ok: false,
        error: createError({
          kind: "InvalidFormat",
          format: ".json, .yaml, .yml, or .toml",
          input: path,
        }),
      };
    }
    return { ok: true, data: new ConfigPath(path) };
  }

  getValue(): string {
    return this.value;
  }

  resolve(basePath: string): string {
    if (this.value.startsWith("/")) {
      return this.value;
    }
    return `${basePath}/${this.value}`;
  }
}

export class OutputPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<OutputPath, ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }

    return { ok: true, data: new OutputPath(path) };
  }

  getValue(): string {
    return this.value;
  }

  withExtension(ext: string): OutputPath {
    const withoutExt = this.value.replace(/\.[^/.]+$/, "");
    return new OutputPath(`${withoutExt}.${ext}`);
  }
}

// Schema-related value objects
export class SchemaDefinition {
  private constructor(
    private readonly value: unknown,
    private readonly version: string,
  ) {}

  static create(
    definition: unknown,
    version: string = "1.0.0",
  ): Result<SchemaDefinition, ValidationError & { message: string }> {
    if (!definition) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }

    if (typeof definition !== "object") {
      return {
        ok: false,
        error: createError({
          kind: "InvalidFormat",
          format: "object",
          input: typeof definition,
        }),
      };
    }

    return { ok: true, data: new SchemaDefinition(definition, version) };
  }

  getValue(): unknown {
    return this.value;
  }

  getVersion(): string {
    return this.version;
  }

  validate(
    _data: unknown,
  ): Result<void, ValidationError & { message: string }> {
    // Placeholder for schema validation logic
    // Would integrate with a JSON Schema validator or similar
    return { ok: true, data: undefined };
  }
}

export class SchemaVersion {
  private constructor(
    private readonly major: number,
    private readonly minor: number,
    private readonly patch: number,
  ) {}

  static create(
    version: string,
  ): Result<SchemaVersion, ValidationError & { message: string }> {
    const pattern = /^(\d+)\.(\d+)\.(\d+)$/;
    const match = version.match(pattern);

    if (!match) {
      return {
        ok: false,
        error: createError({
          kind: "PatternMismatch",
          pattern: "X.Y.Z",
          input: version,
        }),
      };
    }

    const [, major, minor, patch] = match;
    return {
      ok: true,
      data: new SchemaVersion(
        parseInt(major),
        parseInt(minor),
        parseInt(patch),
      ),
    };
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  isCompatibleWith(other: SchemaVersion): boolean {
    return this.major === other.major;
  }
}

// Template-related value objects
export class TemplateFormat {
  private constructor(
    private readonly format: "json" | "yaml" | "toml" | "handlebars" | "custom",
    private readonly template: string,
  ) {}

  static create(
    format: string,
    template: string,
  ): Result<TemplateFormat, ValidationError & { message: string }> {
    if (!template || template.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }

    if (
      format !== "json" && format !== "yaml" && format !== "toml" &&
      format !== "handlebars" && format !== "custom"
    ) {
      return {
        ok: false,
        error: createError({
          kind: "InvalidFormat",
          format: "json, yaml, toml, handlebars, or custom",
          input: format,
        }),
      };
    }

    return {
      ok: true,
      data: new TemplateFormat(
        format as "json" | "yaml" | "toml" | "handlebars" | "custom",
        template,
      ),
    };
  }

  getFormat(): "json" | "yaml" | "toml" | "handlebars" | "custom" {
    return this.format;
  }

  getTemplate(): string {
    return this.template;
  }
}

export class MappingRule {
  private constructor(
    private readonly source: string,
    private readonly target: string,
    private readonly transform?: (value: unknown) => unknown,
  ) {}

  static create(
    source: string,
    target: string,
    transform?: (value: unknown) => unknown,
  ): Result<MappingRule, ValidationError & { message: string }> {
    if (!source || !target) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }

    return { ok: true, data: new MappingRule(source, target, transform) };
  }

  getSource(): string {
    return this.source;
  }

  getTarget(): string {
    return this.target;
  }

  apply(data: Record<string, unknown>): unknown {
    const value = this.getValueByPath(data, this.source);
    return this.transform ? this.transform(value) : value;
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce(
      (acc: unknown, part) => (acc as Record<string, unknown>)?.[part],
      obj,
    );
  }
}

// Processing-related value objects
export class ProcessingOptions {
  private constructor(
    private readonly parallel: boolean,
    private readonly maxConcurrency: number,
    private readonly continueOnError: boolean,
  ) {}

  static create(options: {
    parallel?: boolean;
    maxConcurrency?: number;
    continueOnError?: boolean;
  }): Result<ProcessingOptions, ValidationError & { message: string }> {
    const parallel = options.parallel ?? true;
    const maxConcurrency = options.maxConcurrency ?? 5;
    const continueOnError = options.continueOnError ?? false;

    if (maxConcurrency < 1 || maxConcurrency > 100) {
      return {
        ok: false,
        error: createError({
          kind: "OutOfRange",
          value: maxConcurrency,
          min: 1,
          max: 100,
        }),
      };
    }

    return {
      ok: true,
      data: new ProcessingOptions(parallel, maxConcurrency, continueOnError),
    };
  }

  isParallel(): boolean {
    return this.parallel;
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  shouldContinueOnError(): boolean {
    return this.continueOnError;
  }
}
