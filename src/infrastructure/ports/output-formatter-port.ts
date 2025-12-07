import { Result } from "../../domain/shared/types/result.ts";

/**
 * Supported output format types.
 *
 * ## Adding a New Format
 *
 * To add a new output format (e.g., "toml"):
 *
 * 1. **Update this type** - Add the new format to the union type:
 *    ```typescript
 *    export type OutputFormatType = "json" | "yaml" | "xml" | "markdown" | "toml";
 *    ```
 *
 * 2. **Update DefaultOutputFormatter** (`../adapters/default-output-formatter.ts`):
 *    - Add format to `SUPPORTED_FORMATS` array
 *    - Add case in `format()` switch statement
 *    - Implement `formatToml()` private method
 *
 * 3. **Update CLI** (`src/presentation/cli/index.ts`):
 *    - Add format to argument parsing and validation
 *
 * 4. **Add tests** (`tests/unit/infrastructure/adapters/default-output-formatter_test.ts`):
 *    - Add test cases for the new format
 *
 * The exhaustive switch pattern in DefaultOutputFormatter ensures compile-time
 * errors if a new format is added to this type but not implemented.
 */
export type OutputFormatType = "json" | "yaml" | "xml" | "markdown";

/**
 * Configuration options for output formatting
 */
export interface OutputFormatOptions {
  readonly indent?: number;
  readonly sortKeys?: boolean;
  readonly prettyPrint?: boolean;
}

/**
 * Error type for output formatting operations
 */
export class OutputFormatError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OutputFormatError";
  }
}

/**
 * Port interface for output formatting operations.
 * Abstracts the conversion of data to various string formats.
 * Following hexagonal architecture principles for dependency inversion.
 */
export interface OutputFormatterPort {
  /**
   * Formats data to the specified output format.
   * @param data - The data to format
   * @param format - Target output format
   * @param options - Optional formatting configuration
   * @returns Result containing formatted string or error
   */
  format(
    data: unknown,
    format: OutputFormatType,
    options?: OutputFormatOptions,
  ): Result<string, OutputFormatError>;

  /**
   * Checks if a format is supported.
   * @param format - Format to check
   * @returns true if format is supported
   */
  isFormatSupported(format: string): format is OutputFormatType;

  /**
   * Returns the list of supported formats.
   */
  getSupportedFormats(): readonly OutputFormatType[];
}
