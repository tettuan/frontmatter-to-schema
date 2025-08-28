// Deno-based document repository implementation

import { walk } from "jsr:@std/fs@1.0.8/walk";
import { extract } from "jsr:@std/front-matter@1.0.5/any";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
// Removed unused imports: createError, IOError
import { LoggerFactory } from "../../domain/shared/logger.ts";
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
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    const documents: Document[] = [];
    const pathValue = path.getValue();
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "deno-document-repository",
      );
      verboseLogger.info("Searching for documents", { path: pathValue });
    }

    // Extract directory from glob pattern (e.g., "dir/*.md" -> "dir")
    let dirPath = pathValue;
    if (pathValue.includes("*.md") || pathValue.includes("*.markdown")) {
      // Remove the glob pattern to get the directory
      dirPath = pathValue.replace(/\/?\*\.(md|markdown)$/, "");
      if (!dirPath) dirPath = ".";
    }
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "deno-document-repository",
      );
      verboseLogger.info("Resolved directory path", { dirPath });
    }

    try {
      // Check if path exists
      const stat = await Deno.stat(dirPath);
      if (!stat.isDirectory) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: dirPath,
            details: "Path is not a directory",
          }),
        };
      }

      // Walk through directory to find markdown files
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "deno-document-repository",
        );
        verboseLogger.info("Starting directory walk", { dirPath });
      }

      let fileCount = 0;
      for await (
        const entry of walk(dirPath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
        })
      ) {
        if (verboseMode) {
          const verboseLogger = LoggerFactory.createLogger(
            "deno-document-repository",
          );
          verboseLogger.debug("Found entry", {
            path: entry.path,
            isFile: entry.isFile,
          });
        }

        if (entry.isFile) {
          fileCount++;
          if (verboseMode) {
            const verboseLogger = LoggerFactory.createLogger(
              "deno-document-repository",
            );
            verboseLogger.debug("Processing file", {
              fileCount,
              path: entry.path,
            });
          }

          const docPathResult = DocumentPath.create(entry.path);
          if (docPathResult.ok) {
            const docResult = await this.read(docPathResult.data);
            if (docResult.ok) {
              documents.push(docResult.data);
              if (verboseMode) {
                const verboseLogger = LoggerFactory.createLogger(
                  "deno-document-repository",
                );
                verboseLogger.debug("Successfully processed file", {
                  path: entry.path,
                });
              }
            } else if (verboseMode) {
              const verboseLogger = LoggerFactory.createLogger(
                "deno-document-repository",
              );
              verboseLogger.warn("Failed to read file", {
                path: entry.path,
                error: docResult.error.message || docResult.error.kind,
              });
            }
          } else if (verboseMode) {
            const verboseLogger = LoggerFactory.createLogger(
              "deno-document-repository",
            );
            verboseLogger.warn("Invalid document path", { path: entry.path });
          }
        }
      }

      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "deno-document-repository",
        );
        verboseLogger.info("Walk completed", {
          fileCount,
          processedCount: documents.length,
        });
      }

      return { ok: true, data: documents };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({ kind: "FileNotFound", path: dirPath }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path: dirPath,
            operation: "read",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: dirPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async findByPattern(
    pattern: string,
    basePath: string = ".",
  ): Promise<Result<Document[], DomainError & { message: string }>> {
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
        error: createDomainError({
          kind: "ReadError",
          path: basePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async read(
    path: DocumentPath,
  ): Promise<Result<Document, DomainError & { message: string }>> {
    const filePath = path.getValue();

    try {
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter using discriminated union for totality
      type FrontMatterExtractionResult =
        | { kind: "Present"; frontMatter: FrontMatter }
        | { kind: "Absent" };

      let frontMatterResult: FrontMatterExtractionResult = { kind: "Absent" };
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
            const frontMatter = FrontMatter.create(
              frontMatterContentResult.data,
              rawFrontMatter,
            );
            frontMatterResult = { kind: "Present", frontMatter };
          }
        }
        bodyContent = extracted.body;
      } catch {
        // If frontmatter extraction fails, treat entire content as body
        frontMatterResult = { kind: "Absent" };
      }

      const documentContentResult = DocumentContent.create(bodyContent);
      if (!documentContentResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: filePath,
            details: "Invalid document content",
          }),
        };
      }

      // Create document using discriminated union result
      const frontMatter = frontMatterResult.kind === "Present"
        ? frontMatterResult.frontMatter
        : null;

      const document = Document.createWithFrontMatter(
        path,
        frontMatter,
        documentContentResult.data,
      );
      return { ok: true, data: document };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({ kind: "FileNotFound", path: filePath }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path: filePath,
            operation: "read",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: filePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
