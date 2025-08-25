// Consolidated domain types for Frontmatter to Schema conversion

// Core command and registry types
export interface Command {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}

export interface Registry {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: Command[];
  };
}

export interface RegistrySchema {
  validate(data: unknown): data is Registry;
  format(registry: Registry): string;
}

// Domain types
export interface PromptFile {
  path: string;
  content: string;
  commandStructure: CommandStructure;
}

export interface FrontmatterData {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}

export interface CommandStructure {
  c1: string; // domain/category
  c2: string; // directive/action
  c3: string; // layer/target
  input: string; // input type
  adaptation?: string; // adaptation mode
}

// Schema definition interface
export interface LegacySchemaDefinition {
  version?: {
    type: string;
    description: string;
    pattern?: string;
  };
  description?: {
    type: string;
    description: string;
  };
  tools?: {
    type: string;
    description: string;
    properties?: {
      availableConfigs?: {
        type: string;
        description: string;
      };
      commands?: {
        type: string;
        description: string;
      };
    };
  };
  [key: string]: unknown;
}

// Type aliases for backward compatibility
export type RegistryEntry = Command;
export type MappedEntry = Command;

// Analysis context type - discriminated union for different analysis types
export type AnalysisContext =
  | {
    kind: "SchemaAnalysis";
    document: string;
    schema: unknown; // Schema definition from various sources
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "TemplateMapping";
    document: string;
    schema?: unknown; // Optional schema definition from various sources
    template: TemplateDefinition;
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "ValidationOnly";
    document: string;
    schema: {
      validate: (data: unknown) => { ok: boolean; data?: unknown };
      schema: unknown;
    };
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "BasicExtraction";
    document: string;
    options?: { includeMetadata?: boolean } & Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  };

// Template definition type
export interface TemplateDefinition {
  template: string;
  variables?: Record<string, unknown>;
  mappingRules?: Record<string, string>;
  structure?: Record<string, unknown>;
}

// Type guards
export function isSchemaAnalysis(value: unknown): value is { schema: unknown } {
  return value !== null && typeof value === "object" && "schema" in value;
}

export interface AnalysisResultData<T = unknown> {
  has_frontmatter: boolean;
  frontmatter: {
    title?: string;
    description?: string;
    usage?: string;
  };
  template_variables: string[];
  command_structure: CommandStructure;
  detected_options: {
    has_input_file: boolean;
    has_stdin: boolean;
    has_destination: boolean;
    user_variables: string[];
  };
  data?: T;
}

// Analysis Result class - combines data and metadata
export class AnalysisResult<T = unknown> {
  private metadata: Record<string, unknown> = {};

  constructor(
    public readonly sourceFile: unknown,
    public readonly data: T,
  ) {}

  // Alias for backward compatibility
  get extractedData(): T {
    return this.data;
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMetadata(): Record<string, unknown>;
  getMetadata(key: string): unknown;
  getMetadata(key?: string): Record<string, unknown> | unknown {
    if (key === undefined) {
      return { ...this.metadata };
    }
    return this.metadata[key];
  }

  hasMetadata(key: string): boolean {
    return key in this.metadata;
  }
}
