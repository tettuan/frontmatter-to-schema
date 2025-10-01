/**
 * Type definitions for path resolution.
 *
 * @module
 */

/**
 * Internal representation of path segments.
 */
export type PathSegment =
  | { type: "property"; value: string }
  | { type: "arrayIndex"; value: number }
  | { type: "arrayExpansion" };
