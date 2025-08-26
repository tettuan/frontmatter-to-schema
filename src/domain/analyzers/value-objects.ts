/**
 * Value Objects for TypeScript Analyzer Domain
 * Following Totality principles - all constructors return Result types
 */

import type { Result, ValidationError } from "../shared/types.ts";
import { createError } from "../shared/types.ts";

/**
 * Registry Version value object
 * Ensures version follows semantic versioning pattern
 */
export class RegistryVersion {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<RegistryVersion, ValidationError> {
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(value)) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: `Invalid version format: ${value}. Expected format: X.Y.Z`,
        }),
      };
    }
    return { ok: true, data: new RegistryVersion(value) };
  }

  static createDefault(): RegistryVersion {
    return new RegistryVersion("1.0.0");
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Tool Configuration value object
 */
export class ToolConfiguration {
  private constructor(
    private readonly name: string,
    private readonly enabled: boolean = true,
  ) {}

  static create(
    name: string,
  ): Result<ToolConfiguration, ValidationError> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: "Tool name cannot be empty",
        }),
      };
    }

    const validTools = [
      "git",
      "spec",
      "test",
      "code",
      "docs",
      "meta",
      "build",
      "refactor",
      "debug",
    ];
    if (!validTools.includes(name.toLowerCase())) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: `Invalid tool name: ${name}. Valid tools: ${
            validTools.join(", ")
          }`,
        }),
      };
    }

    return { ok: true, data: new ToolConfiguration(name.toLowerCase()) };
  }

  getName(): string {
    return this.name;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Command value object for registry
 */
export class RegistryCommand {
  private constructor(
    private readonly c1: string,
    private readonly c2: string,
    private readonly c3: string,
    private readonly description: string,
  ) {}

  static create(
    c1: string,
    c2: string,
    c3: string,
    description: string,
  ): Result<RegistryCommand, ValidationError> {
    if (!c1 || !c2 || !c3) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: "Command components (c1, c2, c3) cannot be empty",
        }),
      };
    }

    if (!description || description.trim() === "") {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: "Command description cannot be empty",
        }),
      };
    }

    return {
      ok: true,
      data: new RegistryCommand(
        c1.trim(),
        c2.trim(),
        c3.trim(),
        description.trim(),
      ),
    };
  }

  static createFromPath(
    path: string,
    description: string,
  ): Result<RegistryCommand, ValidationError> {
    // Extract command components from file path
    // e.g., ".agent/climpt/prompts/git/merge-cleanup/develop-branches/f_default.md"
    // -> ["git", "merge-cleanup", "develop-branches"]

    // Look for prompts directory and take path components after it
    let parts: string[] = [];
    if (path.includes("prompts/")) {
      const afterPrompts = path.split("prompts/")[1];
      if (afterPrompts) {
        parts = afterPrompts.split("/").filter((p) => p && !p.includes("."));
      }
    } else {
      // Fallback to original logic
      parts = path.split("/").filter((p) => p && !p.includes("."));
    }

    if (parts.length < 3) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: `Cannot extract command from path: ${path}`,
        }),
      };
    }

    // Take first 3 meaningful parts after prompts/
    const [c1, c2, c3] = parts.slice(0, 3);
    return RegistryCommand.create(c1, c2, c3, description);
  }

  toJSON(): Record<string, string> {
    return {
      c1: this.c1,
      c2: this.c2,
      c3: this.c3,
      description: this.description,
    };
  }

  getC1(): string {
    return this.c1;
  }

  getC2(): string {
    return this.c2;
  }

  getC3(): string {
    return this.c3;
  }

  getDescription(): string {
    return this.description;
  }
}

/**
 * Analysis Context - contains all information needed for analysis
 */
export class AnalysisContext {
  private constructor(
    private readonly documentPath: string,
    private readonly frontMatterData: Record<string, unknown>,
    private readonly schemaData: Record<string, unknown>,
    private readonly templateData: Record<string, unknown>,
  ) {}

  static create(
    documentPath: string,
    frontMatterData: Record<string, unknown>,
    schemaData: Record<string, unknown>,
    templateData: Record<string, unknown>,
  ): Result<AnalysisContext, ValidationError> {
    if (!documentPath) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: "Document path cannot be empty",
        }),
      };
    }

    if (!frontMatterData || Object.keys(frontMatterData).length === 0) {
      return {
        ok: false,
        error: createError({
          kind: "ValidationError",
          message: "FrontMatter data cannot be empty",
        }),
      };
    }

    return {
      ok: true,
      data: new AnalysisContext(
        documentPath,
        frontMatterData,
        schemaData,
        templateData,
      ),
    };
  }

  getDocumentPath(): string {
    return this.documentPath;
  }

  getFrontMatterData(): Record<string, unknown> {
    return this.frontMatterData;
  }

  getSchemaData(): Record<string, unknown> {
    return this.schemaData;
  }

  getTemplateData(): Record<string, unknown> {
    return this.templateData;
  }
}

/**
 * Transformed Registry Data
 */
export class RegistryData {
  private constructor(
    private readonly version: RegistryVersion,
    private readonly description: string,
    private readonly tools: {
      availableConfigs: string[];
      commands: RegistryCommand[];
    },
  ) {}

  static create(
    version: RegistryVersion,
    description: string,
    availableConfigs: string[],
    commands: RegistryCommand[],
  ): RegistryData {
    return new RegistryData(version, description, {
      availableConfigs: [...new Set(availableConfigs)].sort(), // Unique and sorted
      commands,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      version: this.version.getValue(),
      description: this.description,
      tools: {
        availableConfigs: this.tools.availableConfigs,
        commands: this.tools.commands.map((cmd) => cmd.toJSON()),
      },
    };
  }

  getVersion(): RegistryVersion {
    return this.version;
  }

  getDescription(): string {
    return this.description;
  }

  getAvailableConfigs(): string[] {
    return this.tools.availableConfigs;
  }

  getCommands(): RegistryCommand[] {
    return this.tools.commands;
  }
}
