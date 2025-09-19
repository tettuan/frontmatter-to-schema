/**
 * Error Context Factory
 * Standardizes error context creation with common patterns and recovery guidance
 * Follows Factory Pattern for consistent error context generation
 */

/**
 * Error context state using discriminated union for explicit completeness levels
 * Follows Totality principle - eliminates optional properties with explicit states
 */
export type ErrorContextState =
  | {
    readonly kind: "minimal";
    readonly operation: string;
    readonly location: string;
  }
  | {
    readonly kind: "standard";
    readonly operation: string;
    readonly location: string;
    readonly inputs: string;
    readonly errorType: string;
  }
  | {
    readonly kind: "detailed";
    readonly operation: string;
    readonly location: string;
    readonly inputs: string;
    readonly errorType: string;
    readonly decisions: string[];
    readonly progress: string;
    readonly recoveryGuidance: string[];
  }
  | {
    readonly kind: "comprehensive";
    readonly operation: string;
    readonly location: string;
    readonly inputs: string;
    readonly errorType: string;
    readonly decisions: string[];
    readonly progress: string;
    readonly recoveryGuidance: string[];
    readonly additionalData: Record<string, unknown>;
    readonly contextDepth: number;
    readonly parentContext: ErrorContextState;
  };

/**
 * Performance metrics state using discriminated union for measurement completeness
 * Eliminates optional measurement properties with explicit measurement levels
 */
export type PerformanceMetricsState =
  | {
    readonly kind: "none";
  }
  | {
    readonly kind: "basic";
    readonly duration: number;
  }
  | {
    readonly kind: "throughput";
    readonly duration: number;
    readonly filesPerSecond: number;
  }
  | {
    readonly kind: "comprehensive";
    readonly duration: number;
    readonly filesPerSecond: number;
    readonly memoryPeakMB: number;
    readonly currentBatchSize: number;
    readonly recommendedBatchSize: number;
  };

/**
 * Legacy interface for backward compatibility
 * @deprecated Use ErrorContextState discriminated union for type safety
 */
export interface ErrorContextData {
  operation: string;
  location: string;
  inputs?: string;
  decisions?: string[];
  progress?: string;
  errorType?: string;
  recoveryGuidance?: string[];
  additionalData?: Record<string, unknown>;
  contextDepth?: number;
  parentContext?: ErrorContextData;
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use PerformanceMetricsState discriminated union for type safety
 */
export interface PerformanceMetrics {
  filesPerSecond?: number;
  memoryPeakMB?: number;
  recommendedBatchSize?: number;
  currentBatchSize?: number;
  duration?: number;
}

/**
 * Standard Error Context Factory
 * Provides consistent error context creation with recovery guidance
 */
export class ErrorContextFactory {
  /**
   * Create minimal error context for simple cases
   * Follows Totality principle with explicit state creation
   */
  static createMinimal(operation: string, location: string): ErrorContextState {
    return {
      kind: "minimal",
      operation,
      location,
    };
  }

  /**
   * Create standard error context with basic error information
   * Includes input details and error type classification
   */
  static createStandard(
    operation: string,
    location: string,
    inputs: string,
    errorType: string,
  ): ErrorContextState {
    return {
      kind: "standard",
      operation,
      location,
      inputs,
      errorType,
    };
  }

  /**
   * Create detailed error context with recovery guidance
   * Includes decisions, progress tracking, and recovery instructions
   */
  static createDetailed(
    operation: string,
    location: string,
    inputs: string,
    errorType: string,
    decisions: string[],
    progress: string,
    recoveryGuidance: string[],
  ): ErrorContextState {
    return {
      kind: "detailed",
      operation,
      location,
      inputs,
      errorType,
      decisions,
      progress,
      recoveryGuidance,
    };
  }

  /**
   * Create comprehensive error context with full debugging information
   * Includes hierarchical context and additional debugging data
   */
  static createComprehensive(
    operation: string,
    location: string,
    inputs: string,
    errorType: string,
    decisions: string[],
    progress: string,
    recoveryGuidance: string[],
    additionalData: Record<string, unknown>,
    contextDepth: number,
    parentContext: ErrorContextState,
  ): ErrorContextState {
    return {
      kind: "comprehensive",
      operation,
      location,
      inputs,
      errorType,
      decisions,
      progress,
      recoveryGuidance,
      additionalData,
      contextDepth,
      parentContext,
    };
  }

  /**
   * Performance metrics factory methods
   */
  static createNoMetrics(): PerformanceMetricsState {
    return { kind: "none" };
  }

  static createBasicMetrics(duration: number): PerformanceMetricsState {
    return {
      kind: "basic",
      duration,
    };
  }

  static createThroughputMetrics(
    duration: number,
    filesPerSecond: number,
  ): PerformanceMetricsState {
    return {
      kind: "throughput",
      duration,
      filesPerSecond,
    };
  }

  static createComprehensiveMetrics(
    duration: number,
    filesPerSecond: number,
    memoryPeakMB: number,
    currentBatchSize: number,
    recommendedBatchSize: number,
  ): PerformanceMetricsState {
    return {
      kind: "comprehensive",
      duration,
      filesPerSecond,
      memoryPeakMB,
      currentBatchSize,
      recommendedBatchSize,
    };
  }

  /**
   * Backward compatibility helper - converts legacy interface
   * @deprecated Use explicit state creation methods for better type safety
   */
  static fromLegacy(data: ErrorContextData): ErrorContextState {
    if (
      data.additionalData && data.contextDepth !== undefined &&
      data.parentContext
    ) {
      return this.createComprehensive(
        data.operation,
        data.location,
        data.inputs || "",
        data.errorType || "unknown",
        data.decisions || [],
        data.progress || "",
        data.recoveryGuidance || [],
        data.additionalData,
        data.contextDepth,
        this.fromLegacy(data.parentContext),
      );
    }
    if (data.decisions && data.progress && data.recoveryGuidance) {
      return this.createDetailed(
        data.operation,
        data.location,
        data.inputs || "",
        data.errorType || "unknown",
        data.decisions,
        data.progress,
        data.recoveryGuidance,
      );
    }
    if (data.inputs && data.errorType) {
      return this.createStandard(
        data.operation,
        data.location,
        data.inputs,
        data.errorType,
      );
    }
    return this.createMinimal(data.operation, data.location);
  }

  /**
   * Legacy Methods - Maintaining backward compatibility
   * Creates a schema-related error context with standard recovery guidance
   */
  static createSchemaError(
    operation: string,
    location: string,
    schemaPath: string,
    errorDetails?: string,
  ): ErrorContextData {
    return {
      operation: `Schema: ${operation}`,
      location,
      inputs: `schemaPath="${schemaPath}", errorType=${
        errorDetails || "unknown"
      }`,
      decisions: [
        "Schema validation strategy - Detected validation failure",
      ],
      recoveryGuidance: [
        "Verify schema file exists and is readable",
        "Validate JSON syntax using online validator",
        "Check schema follows JSON Schema draft-07 specification",
        "Ensure all required properties are defined",
      ],
      errorType: "SchemaValidationError",
    };
  }

  /**
   * Creates a template-related error context with resolution guidance
   */
  static createTemplateError(
    operation: string,
    location: string,
    templatePath: string,
    schemaPath?: string,
  ): ErrorContextData {
    return {
      operation: `Template: ${operation}`,
      location,
      inputs: `templatePath="${templatePath}", schemaPath="${
        schemaPath || "unknown"
      }"`,
      decisions: [
        "Template resolution strategy - Template path resolution failed",
      ],
      recoveryGuidance: [
        "Verify template file exists in expected location",
        "Check template file permissions are readable",
        "Ensure schema contains valid 'x-template' property",
        "Verify template file contains valid JSON structure",
      ],
      errorType: "TemplateResolutionError",
    };
  }

  /**
   * Creates a frontmatter processing error context
   */
  static createFrontmatterError(
    operation: string,
    location: string,
    filePath: string,
    lineNumber?: number,
  ): ErrorContextData {
    return {
      operation: `Frontmatter: ${operation}`,
      location,
      inputs: `filePath="${filePath}", line=${lineNumber || "unknown"}`,
      decisions: [
        "Frontmatter parsing strategy - YAML parsing failed",
      ],
      recoveryGuidance: [
        "Verify frontmatter uses valid YAML syntax",
        "Check for proper --- delimiters at start and end",
        "Ensure no tabs are used (spaces only for indentation)",
        "Validate special characters are properly quoted",
      ],
      errorType: "FrontmatterParsingError",
    };
  }

  /**
   * Creates a performance-related error context with optimization guidance
   */
  static createPerformanceError(
    operation: string,
    location: string,
    metrics: PerformanceMetrics,
  ): ErrorContextData {
    return {
      operation: `Performance: ${operation}`,
      location,
      inputs: `fileCount=${metrics.currentBatchSize || "unknown"}, duration=${
        metrics.duration || "unknown"
      }ms`,
      decisions: [
        "Performance optimization strategy - Processing limits exceeded",
      ],
      recoveryGuidance: [
        `Reduce batch size to ${
          metrics.recommendedBatchSize || 100
        }-200 files per batch`,
        "Enable streaming mode for datasets >1000 files",
        "Consider parallel processing with worker threads",
        "Monitor memory usage and implement garbage collection triggers",
      ],
      errorType: "PerformanceError",
      additionalData: {
        performanceMetrics: metrics,
      },
    };
  }

  /**
   * Creates a file system error context
   */
  static createFileSystemError(
    operation: string,
    location: string,
    filePath: string,
    systemError?: string,
  ): ErrorContextData {
    return {
      operation: `FileSystem: ${operation}`,
      location,
      inputs: `filePath="${filePath}", systemError="${
        systemError || "unknown"
      }"`,
      decisions: [
        "File system access strategy - Access denied or file not found",
      ],
      recoveryGuidance: [
        "Verify file path exists and is accessible",
        "Check file permissions (read/write as needed)",
        "Ensure parent directory exists for output files",
        "Verify sufficient disk space for write operations",
      ],
      errorType: "FileSystemError",
    };
  }

  /**
   * Creates a pipeline orchestration error context
   */
  static createPipelineError(
    operation: string,
    location: string,
    stage: string,
    progress: string,
  ): ErrorContextData {
    return {
      operation: `Pipeline: ${operation}`,
      location,
      inputs: `stage="${stage}", progress="${progress}"`,
      decisions: [
        "Pipeline execution strategy - Stage processing failed",
      ],
      progress: `Pipeline Processing: ${stage} (${progress})`,
      recoveryGuidance: [
        "Review previous pipeline stages for cascading failures",
        "Check input data validity and format",
        "Verify all required dependencies are available",
        "Consider running pipeline with verbose logging enabled",
      ],
      errorType: "PipelineExecutionError",
    };
  }

  /**
   * Creates a validation error context with detailed guidance
   */
  static createValidationError(
    operation: string,
    location: string,
    validationTarget: string,
    validationRules: string[],
    failedRules: string[],
  ): ErrorContextData {
    return {
      operation: `Validation: ${operation}`,
      location,
      inputs:
        `target="${validationTarget}", rulesCount=${validationRules.length}`,
      decisions: [
        `Validation strategy - ${failedRules.length} validation rules failed`,
      ],
      recoveryGuidance: [
        "Review failed validation rules and correct input data",
        "Ensure data types match expected schema definitions",
        "Check for required fields that may be missing",
        "Validate data format matches expected patterns",
      ],
      errorType: "ValidationError",
      additionalData: {
        validationRules,
        failedRules,
      },
    };
  }

  /**
   * Creates a hierarchical error context with parent reference
   */
  static createChildContext(
    parentContext: ErrorContextData,
    operation: string,
    location: string,
    inputs?: string,
  ): ErrorContextData {
    return {
      operation,
      location,
      inputs,
      contextDepth: (parentContext.contextDepth || 0) + 1,
      parentContext,
      decisions: [
        "Child operation execution - Nested processing failure",
      ],
      recoveryGuidance: [
        "Review parent operation context for root cause",
        "Verify child operation inputs are valid",
        "Check for cascading failures from parent operations",
      ],
    };
  }

  /**
   * Creates a generic error context with custom recovery guidance
   */
  static createCustomError(
    operation: string,
    location: string,
    errorType: string,
    recoveryGuidance: string[],
    additionalData?: Record<string, unknown>,
  ): ErrorContextData {
    return {
      operation,
      location,
      errorType,
      recoveryGuidance,
      additionalData,
      decisions: [
        "Custom error handling strategy - Specific error condition detected",
      ],
    };
  }

  /**
   * Formats error context data into a readable string
   */
  static formatContext(context: ErrorContextData): string {
    const parts: string[] = [];

    parts.push(`Operation: ${context.operation}`);
    parts.push(`Location: ${context.location}`);

    if (context.inputs) {
      parts.push(`Inputs: ${context.inputs}`);
    }

    if (context.errorType) {
      parts.push(`Error Type: ${context.errorType}`);
    }

    if (context.progress) {
      parts.push(`Progress: ${context.progress}`);
    }

    if (context.decisions && context.decisions.length > 0) {
      parts.push(`Decisions: ${context.decisions.join("; ")}`);
    }

    if (context.recoveryGuidance && context.recoveryGuidance.length > 0) {
      parts.push(`Recovery Guidance:`);
      context.recoveryGuidance.forEach((guidance, index) => {
        parts.push(`  ${index + 1}. ${guidance}`);
      });
    }

    if (context.contextDepth !== undefined && context.contextDepth > 0) {
      parts.push(`Context Depth: ${context.contextDepth}`);
    }

    if (context.parentContext) {
      parts.push(`Parent Context: ${context.parentContext.operation}`);
    }

    return parts.join("\n");
  }
}
