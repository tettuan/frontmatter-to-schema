/**
 * Path resolution error types.
 *
 * @module
 */

/**
 * Error codes for path resolution failures.
 */
export enum PathErrorCode {
  /** Path does not exist in the data structure */
  PATH_NOT_FOUND = "PATH_NOT_FOUND",

  /** Path syntax is invalid */
  INVALID_PATH_SYNTAX = "INVALID_PATH_SYNTAX",

  /** Data structure is invalid for the operation */
  INVALID_STRUCTURE = "INVALID_STRUCTURE",

  /** Expected an array but got a different type */
  ARRAY_EXPECTED = "ARRAY_EXPECTED",

  /** Array index is out of bounds */
  INDEX_OUT_OF_BOUNDS = "INDEX_OUT_OF_BOUNDS",
}

/**
 * Error class for path resolution failures.
 */
export class PathError extends Error {
  constructor(
    public readonly code: PathErrorCode,
    message: string,
    public readonly path: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PathError";
  }
}
