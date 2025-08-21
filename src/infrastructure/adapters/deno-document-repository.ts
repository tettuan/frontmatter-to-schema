// Deno-based document repository implementation

import { walk } from "jsr:@std/fs@1.0.8/walk";
import { extract } from "jsr:@std/front-matter@1.0.5/any";
import {
  createError,
  type IOError,
  type Result,
} from "../../domain/shared/types.ts";
import { Document, FrontMatter } from "../../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
} from "../../domain/models/value-objects.ts";
import type { DocumentRepository } from "../../domain/services/interfaces.ts";

export class DenoDocumentRepository implements DocumentRepository {
  async findAll(
    path: DocumentPath,
  ): Promise<Result<Document[], IOError & { message: string }>> {
    const documents: Document[] = [];
    const pathValue = path.getValue();

    // Extract directory from glob pattern (e.g., "dir/*.md" -> "dir")
    let dirPath = pathValue;
    if (pathValue.includes("*.md") || pathValue.includes("*.markdown")) {
      // Remove the glob pattern to get the directory
      dirPath = pathValue.replace(/\/?\*\.(md|markdown)$/, "");
      if (!dirPath) dirPath = ".";
    }

    try {
      // Check if path exists
      const stat = await Deno.stat(dirPath);
      if (!stat.isDirectory) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: dirPath,
            reason: "Path is not a directory",
          }),
        };
      }

      // Walk through directory to find markdown files
      for await (
        const entry of walk(dirPath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
        })
      ) {
        if (entry.isFile) {
          const docPathResult = DocumentPath.create(entry.path);
          if (docPathResult.ok) {
            const docResult = await this.read(docPathResult.data);
            if (docResult.ok) {
              documents.push(docResult.data);
            }
          }
        }
      }

      return { ok: true, data: documents };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: dirPath }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createError({ kind: "PermissionDenied", path: dirPath }),
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: dirPath,
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async findByPattern(
    pattern: string,
    basePath: string = ".",
  ): Promise<Result<Document[], IOError & { message: string }>> {
    const documents: Document[] = [];
    const regex = new RegExp(pattern);

    try {
      for await (
        const entry of walk(basePath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
          match: [regex],
        })
      ) {
        if (entry.isFile) {
          const docPathResult = DocumentPath.create(entry.path);
          if (docPathResult.ok) {
            const docResult = await this.read(docPathResult.data);
            if (docResult.ok) {
              documents.push(docResult.data);
            }
          }
        }
      }

      return { ok: true, data: documents };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: basePath,
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async read(
    path: DocumentPath,
  ): Promise<Result<Document, IOError & { message: string }>> {
    const filePath = path.getValue();

    try {
      const content = await Deno.readTextFile(filePath);

      // Try to extract frontmatter
      let frontMatter: FrontMatter | null = null;
      let bodyContent = content;

      try {
        const extracted = extract(content);
        if (
          extracted.frontMatter && Object.keys(extracted.frontMatter).length > 0
        ) {
          // Convert frontmatter to string representation
          const frontMatterStr = JSON.stringify(extracted.frontMatter);
          const frontMatterContentResult = FrontMatterContent.create(
            frontMatterStr,
          );

          if (frontMatterContentResult.ok) {
            // Get raw frontmatter section
            const rawFrontMatter =
              content.match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
            frontMatter = FrontMatter.create(
              frontMatterContentResult.data,
              rawFrontMatter,
            );
          }
        }
        bodyContent = extracted.body;
      } catch {
        // If frontmatter extraction fails, treat entire content as body
      }

      const documentContentResult = DocumentContent.create(bodyContent);
      if (!documentContentResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: filePath,
            reason: "Invalid document content",
          }),
        };
      }

      const document = Document.create(
        path,
        frontMatter,
        documentContentResult.data,
      );
      return { ok: true, data: document };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: filePath }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createError({ kind: "PermissionDenied", path: filePath }),
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: filePath,
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
