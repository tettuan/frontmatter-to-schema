// Deno-based document repository implementation

import { walk } from "jsr:@std/fs@1.0.8/walk";
import { extract } from "jsr:@std/front-matter@1.0.5/any";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
// Removed unused imports: createError, IOError  
import { VerboseLoggingUtility } from "../../domain/services/verbose-logging-utility.ts";
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

    VerboseLoggingUtility.logInfo(
      "deno-document-repository",
      "Searching for documents",
      { path: pathValue },
    );

    // Extract directory from glob pattern (e.g., "dir/*.md" -> "dir")
    let dirPath = pathValue;
    if (pathValue.includes("*.md") || pathValue.includes("*.markdown")) {
      // Remove the glob pattern to get the directory
      dirPath = pathValue.replace(/\/?\*\.(md|markdown)$/, "");
      if (!dirPath) dirPath = ".";
    }
    VerboseLoggingUtility.logInfo(
      "deno-document-repository",
      "Resolved directory path",
      { dirPath },
    );

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
      VerboseLoggingUtility.logInfo(
        "deno-document-repository",
        "Starting directory walk",
        { dirPath },
      );

      let fileCount = 0;
      for await (
        const entry of walk(dirPath, {
          exts: [".md", ".markdown"],
          skip: [/node_modules/, /\.git/],
        })
      ) {
        VerboseLoggingUtility.logDebug(
          "deno-document-repository",
          "Found entry",
          {
            path: entry.path,
            isFile: entry.isFile,
          },
        );

        if (entry.isFile) {
          fileCount++;
          VerboseLoggingUtility.logDebug(
            "deno-document-repository",
            "Processing file",
            {
              fileCount,
              path: entry.path,
            },
          );

          const docPathResult = DocumentPath.create(entry.path);
          if (docPathResult.ok) {
            const docResult = await this.read(docPathResult.data);
            if (docResult.ok) {
              documents.push(docResult.data);
              VerboseLoggingUtility.logDebug(
                "deno-document-repository",
                "Successfully processed file",
                { path: entry.path },
              );
            } else {
              VerboseLoggingUtility.logWarn(
                "deno-document-repository",
                "Failed to read file",
                {
                  path: entry.path,
                  error: docResult.error.message || docResult.error.kind,
                },
              );
            }
          } else {
            VerboseLoggingUtility.logWarn(
              "deno-document-repository",
              "Invalid document path",
              { path: entry.path },
            );
          }
        }
      }

      VerboseLoggingUtility.logInfo(
        "deno-document-repository",
        "Walk completed",
        {
          fileCount,
          processedCount: documents.length,
        },
      );

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
        // Use attrs (parsed object) instead of frontMatter (raw string)
        if (
          extracted.attrs && typeof extracted.attrs === "object" &&
          Object.keys(extracted.attrs).length > 0
        ) {
          // Create FrontMatterContent from the parsed object
          const frontMatterContentResult = FrontMatterContent.fromObject(
            extracted.attrs as Record<string, unknown>,
          );

          if (frontMatterContentResult.ok) {
            // Get raw frontmatter section - extracted.frontMatter contains the raw YAML
            const rawFrontMatter = typeof extracted.frontMatter === "string"
              ? extracted.frontMatter
              : "";
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
