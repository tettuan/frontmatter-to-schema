/**
 * Process Documents Options Value Object
 * Extracted from process-documents-usecase.ts for better domain separation
 * Provides Smart Constructor for options validation following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import {
  DEFAULT_MAX_WORKERS_VALUE,
  MAX_WORKERS_LIMIT_VALUE,
  MIN_WORKERS_LIMIT_VALUE,
} from "../../domain/shared/constants.ts";

/**
 * Process Documents Options Value Object with validation
 */
export class ProcessDocumentsOptions {
  private constructor(
    private readonly verbose: boolean = false,
    private readonly dryRun: boolean = false,
    private readonly parallel: boolean = false,
    private readonly maxWorkers: number = DEFAULT_MAX_WORKERS_VALUE.getValue(),
  ) {}

  static create(options: {
    verbose?: boolean;
    dryRun?: boolean;
    parallel?: boolean;
    maxWorkers?: number;
  } = {}): Result<ProcessDocumentsOptions, DomainError & { message: string }> {
    // Validate verbose
    if (options.verbose !== undefined && typeof options.verbose !== "boolean") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(options.verbose),
          expectedFormat: "boolean",
        }, "Verbose option must be a boolean"),
      };
    }

    // Validate dryRun
    if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(options.dryRun),
          expectedFormat: "boolean",
        }, "Dry run option must be a boolean"),
      };
    }

    // Validate parallel
    if (
      options.parallel !== undefined && typeof options.parallel !== "boolean"
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(options.parallel),
          expectedFormat: "boolean",
        }, "Parallel option must be a boolean"),
      };
    }

    // Validate maxWorkers
    const maxWorkers = options.maxWorkers ??
      DEFAULT_MAX_WORKERS_VALUE.getValue();
    if (
      typeof maxWorkers !== "number" ||
      maxWorkers < MIN_WORKERS_LIMIT_VALUE.getValue() ||
      maxWorkers > MAX_WORKERS_LIMIT_VALUE.getValue()
    ) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(options.maxWorkers),
            expectedFormat:
              `number between ${MIN_WORKERS_LIMIT_VALUE.getValue()} and ${MAX_WORKERS_LIMIT_VALUE.getValue()}`,
          },
          `Max workers must be a number between ${MIN_WORKERS_LIMIT_VALUE.getValue()} and ${MAX_WORKERS_LIMIT_VALUE.getValue()}`,
        ),
      };
    }

    return {
      ok: true,
      data: new ProcessDocumentsOptions(
        options.verbose ?? false,
        options.dryRun ?? false,
        options.parallel ?? false,
        maxWorkers,
      ),
    };
  }

  isVerbose(): boolean {
    return this.verbose;
  }

  isDryRun(): boolean {
    return this.dryRun;
  }

  isParallel(): boolean {
    return this.parallel;
  }

  getMaxWorkers(): number {
    return this.maxWorkers;
  }

  toObject() {
    return {
      verbose: this.verbose,
      dryRun: this.dryRun,
      parallel: this.parallel,
      maxWorkers: this.maxWorkers,
    };
  }
}
