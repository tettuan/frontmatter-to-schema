// Core domain types following totality principle

import type { ErrorCode as _ErrorCode } from "./error-messages.ts";
import type {
  ErrorMessages as _ErrorMessages,
  getErrorCode as _getErrorCode,
} from "./error-messages.ts";

// Import Result type from the canonical location
import type { Result } from "../core/result.ts";

// Re-export for backward compatibility
export type { Result };

// Legacy error types removed - use domain/core/result.ts instead

// Legacy error creation helpers removed - use createDomainError from domain/core/result.ts instead

// Legacy Result combinators removed - use functions from domain/core/result.ts instead
// Available functions: isOk, isError, unwrapOrResult, mapResult, flatMapResult
