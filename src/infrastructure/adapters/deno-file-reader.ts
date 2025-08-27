/**
 * Deno implementation of the FileReader interface
 *
 * This adapter provides file system access using Deno's built-in APIs,
 * implementing the FileReader interface from the domain layer.
 */

import type { FileReader } from "../../domain/services/interfaces.ts";

export class DenoFileReader implements FileReader {
  async readTextFile(path: string): Promise<string> {
    try {
      return await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`File not found: ${path}`);
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        throw new Error(`Permission denied to read file: ${path}`);
      }
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }
}
