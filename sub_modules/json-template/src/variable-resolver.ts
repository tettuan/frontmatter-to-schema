/**
 * Variable resolution with support for dot notation and array access
 */

import { VariableNotFoundError } from './errors.ts';
import type { VariableValue } from './types.ts';

export class VariableResolver {
  constructor(private readonly data: unknown) {}

  /**
   * Resolve a variable path to its value in the JSON data
   * Supports dot notation (object.property) and array access (array[0])
   * @param path - Variable path (e.g., "user.name", "items[0].title")
   * @returns The resolved value
   * @throws VariableNotFoundError if path cannot be resolved
   */
  resolve(path: string): VariableValue {
    if (path === null || path === undefined) {
      throw new VariableNotFoundError(path);
    }

    try {
      return this.resolvePath(this.data, path);
    } catch (error) {
      if (error instanceof VariableNotFoundError) {
        throw error;
      }
      throw new VariableNotFoundError(path);
    }
  }

  private resolvePath(obj: unknown, path: string): VariableValue {
    if (obj === null || obj === undefined) {
      throw new VariableNotFoundError(path);
    }

    // Handle simple property access (no dots or brackets)
    if (!path.includes('.') && !path.includes('[')) {
      return this.getProperty(obj, path) as VariableValue;
    }

    // Parse path segments
    const segments = this.parsePath(path);
    let current: unknown = obj;

    for (const segment of segments) {
      try {
        current = this.getProperty(current, segment);
        // Don't check for undefined here, as it could be a valid array element value
      } catch (error) {
        if (error instanceof VariableNotFoundError) {
          throw new VariableNotFoundError(path);
        }
        throw error;
      }
    }

    return current as VariableValue;
  }

  private parsePath(path: string): string[] {
    const segments: string[] = [];
    let current = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        if (current) {
          segments.push(current);
          current = '';
        }
        inBrackets = true;
      } else if (char === ']') {
        if (inBrackets && current) {
          segments.push(current);
          current = '';
        }
        inBrackets = false;
      } else if (char === '.' && !inBrackets) {
        if (current) {
          segments.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }

  private getProperty(obj: unknown, key: string): unknown {
    if (obj === undefined) {
      throw new VariableNotFoundError(key);
    }

    if (obj === null) {
      throw new VariableNotFoundError(key);
    }

    // Handle array access with numeric index or length
    if (Array.isArray(obj)) {
      if (key === 'length') {
        return obj.length;
      }
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0 || index >= obj.length) {
        throw new VariableNotFoundError(key);
      }
      // Return the value even if it's undefined - it's a valid array element
      return obj[index];
    }

    // Handle object property access
    if (typeof obj === 'object' && obj !== null) {
      const objRecord = obj as Record<string, unknown>;
      if (!(key in objRecord)) {
        throw new VariableNotFoundError(key);
      }
      return objRecord[key]; // This may return undefined, null, or any value
    }

    throw new VariableNotFoundError(key);
  }

  /**
   * Check if a variable path exists in the data
   * @param path - Variable path to check
   * @returns true if path exists, false otherwise
   */
  exists(path: string): boolean {
    try {
      this.resolve(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all variable references from a template string
   * @param template - Template string containing {variable.path} references
   * @returns Array of unique variable paths
   */
  static extractVariables(template: string): string[] {
    // Look for {variable} patterns that are within quoted strings
    // Allow alphanumeric, dots, brackets, underscores, but exclude quotes
    const variableRegex = /"\{\s*([^"}]*?)\s*\}"/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      if (match[1] !== undefined) {
        const variable = match[1].trim();
        // Only add valid variable names (no quotes inside)
        if (!variable.includes('"')) {
          variables.add(variable);
        }
      }
    }

    return Array.from(variables);
  }
}