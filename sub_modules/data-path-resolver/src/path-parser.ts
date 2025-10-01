/**
 * Path expression parser.
 *
 * @module
 */

import { PathError, PathErrorCode } from "./path-error.ts";
import { Result } from "./result.ts";
import type { PathSegment } from "./types.ts";

/**
 * Parses a path expression into segments.
 *
 * @param path - Path expression (e.g., "items[].name")
 * @returns Result containing parsed segments or error
 */
export function parsePath(path: string): Result<PathSegment[], PathError> {
  if (!path || path.trim() === "") {
    return Result.error(
      new PathError(
        PathErrorCode.INVALID_PATH_SYNTAX,
        "Path cannot be empty",
        path,
      ),
    );
  }

  const segments: PathSegment[] = [];
  const tokens = tokenize(path);

  if (tokens.isError()) {
    return Result.error(tokens.unwrapError());
  }

  for (const token of tokens.unwrap()) {
    const segment = classifyToken(token, path);
    if (segment.isError()) {
      return Result.error(segment.unwrapError());
    }
    segments.push(segment.unwrap());
  }

  return Result.ok(segments);
}

/**
 * Tokenizes a path expression.
 */
function tokenize(path: string): Result<string[], PathError> {
  const tokens: string[] = [];
  let current = "";
  let i = 0;

  while (i < path.length) {
    const char = path[i];

    if (char === ".") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      i++;
    } else if (char === "[") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      // Find matching ]
      const start = i;
      i++;
      while (i < path.length && path[i] !== "]") {
        i++;
      }
      if (i >= path.length) {
        return Result.error(
          new PathError(
            PathErrorCode.INVALID_PATH_SYNTAX,
            "Unclosed bracket in path",
            path,
            { position: start },
          ),
        );
      }
      tokens.push(path.substring(start, i + 1));
      i++;
    } else {
      current += char;
      i++;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return Result.ok(tokens);
}

/**
 * Classifies a token into a path segment.
 */
function classifyToken(
  token: string,
  path: string,
): Result<PathSegment, PathError> {
  // Array expansion: []
  if (token === "[]") {
    return Result.ok({ type: "arrayExpansion" });
  }

  // Array index: [0], [1], etc.
  const indexMatch = token.match(/^\[(\d+)\]$/);
  if (indexMatch && indexMatch[1]) {
    const index = parseInt(indexMatch[1], 10);
    return Result.ok({ type: "arrayIndex", value: index });
  }

  // Property: name, user, etc.
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
    return Result.ok({ type: "property", value: token });
  }

  return Result.error(
    new PathError(
      PathErrorCode.INVALID_PATH_SYNTAX,
      `Invalid token: ${token}`,
      path,
      { token },
    ),
  );
}
