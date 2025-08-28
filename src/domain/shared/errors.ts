/**
 * @deprecated This file contains legacy error types and helpers.
 * Please use the unified error system from domain/core/result.ts instead.
 *
 * Migration guide:
 * - ValidationError → Use ValidationError from domain/core/result.ts
 * - ProcessingError → Use PipelineError or AnalysisError from domain/core/result.ts
 * - IOError → Use FileSystemError from domain/core/result.ts
 * - APIError → Use ExternalServiceError or AIServiceError from domain/core/result.ts
 * - ConfigurationError → Use ConfigurationError from domain/core/result.ts
 *
 * Import example:
 * import { createDomainError, type DomainError } from "../../domain/core/result.ts";
 */

// Re-export from the new location for backward compatibility during migration
export type { DomainError } from "../core/result.ts";
