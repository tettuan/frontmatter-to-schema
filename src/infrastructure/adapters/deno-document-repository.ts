/**
 * Deno-based Document Repository Implementation (Refactored)
 *
 * Orchestrates file discovery, reading, and frontmatter extraction services
 * Part of the File Management Context (Infrastructure Layer)
 * Follows DDD and Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { VerboseLoggerService } from "../services/verbose-logger-service.ts";
import { Document } from "../../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../../domain/models/value-objects.ts";
import type { DocumentRepository } from "../../domain/services/interfaces.ts";

// Service imports
import { FileDiscoveryService } from "../file-system/file-discovery.service.ts";
import { DocumentReaderService } from "../file-system/document-reader.service.ts";
import { FrontmatterExtractorService } from "../../domain/frontmatter/frontmatter-extractor.service.ts";

/**
 * Refactored Document Repository that orchestrates specialized services
 * Each service handles a specific aspect of document processing
 */
export class DenoDocumentRepository implements DocumentRepository {
  private readonly fileDiscovery: FileDiscoveryService;
  private readonly documentReader: DocumentReaderService;
  private readonly frontmatterExtractor: FrontmatterExtractorService;

  constructor() {
    this.fileDiscovery = new FileDiscoveryService();
    this.documentReader = new DocumentReaderService();
    this.frontmatterExtractor = new FrontmatterExtractorService();
  }

  /**
   * Find all documents matching the path pattern
   */
  async findAll(
    path: DocumentPath,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    VerboseLoggerService.logInfo(
      "deno-document-repository",
      "Starting document discovery",
      { path: path.getValue() },
    );

    // Step 1: Discover files
    const discoveryResult = await this.fileDiscovery.findMarkdownFiles(path);
    if (!discoveryResult.ok) {
      return discoveryResult;
    }

    const filePaths = discoveryResult.data;
    VerboseLoggerService.logInfo(
      "deno-document-repository",
      "Files discovered, reading content",
      { fileCount: filePaths.length },
    );

    // Step 2: Read file contents
    const documents: Document[] = [];
    for (const filePath of filePaths) {
      const docPathResult = DocumentPath.create(filePath);
      if (docPathResult.ok) {
        const docResult = await this.read(docPathResult.data);
        if (docResult.ok) {
          documents.push(docResult.data);
        } else {
          VerboseLoggerService.logWarn(
            "deno-document-repository",
            "Failed to process document",
            {
              path: filePath,
              error: docResult.error.message || docResult.error.kind,
            },
          );
        }
      }
    }

    VerboseLoggerService.logInfo(
      "deno-document-repository",
      "Document processing completed",
      {
        discoveredFiles: filePaths.length,
        processedDocuments: documents.length,
      },
    );

    return { ok: true, data: documents };
  }

  /**
   * Find documents by regex pattern
   */
  async findByPattern(
    pattern: string,
    basePath: string = ".",
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    VerboseLoggerService.logInfo(
      "deno-document-repository",
      "Starting pattern-based discovery",
      { pattern, basePath },
    );

    // Step 1: Discover files by pattern
    const discoveryResult = await this.fileDiscovery.findByPattern(
      pattern,
      basePath,
    );
    if (!discoveryResult.ok) {
      return discoveryResult;
    }

    // Step 2: Process discovered files
    const documents: Document[] = [];
    for (const filePath of discoveryResult.data) {
      const docPathResult = DocumentPath.create(filePath);
      if (docPathResult.ok) {
        const docResult = await this.read(docPathResult.data);
        if (docResult.ok) {
          documents.push(docResult.data);
        }
      }
    }

    return { ok: true, data: documents };
  }

  /**
   * Read a single document from path
   */
  async read(
    path: DocumentPath,
  ): Promise<Result<Document, DomainError & { message: string }>> {
    const filePath = path.getValue();

    VerboseLoggerService.logDebug(
      "deno-document-repository",
      "Reading document",
      { path: filePath },
    );

    // Step 1: Read file content
    const contentResult = await this.documentReader.readFileContent(filePath);
    if (!contentResult.ok) {
      return contentResult;
    }

    // Step 2: Extract frontmatter
    const extractionResult = this.frontmatterExtractor.extractFromContent(
      contentResult.data.content,
    );

    // Step 3: Create document content
    const documentContentResult = DocumentContent.create(extractionResult.body);
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

    // Step 4: Assemble document
    const frontMatter = extractionResult.kind === "Present"
      ? extractionResult.frontMatter
      : null;

    const document = Document.createWithFrontMatter(
      path,
      frontMatter,
      documentContentResult.data,
    );

    VerboseLoggerService.logDebug(
      "deno-document-repository",
      "Document created successfully",
      {
        path: filePath,
        hasFrontMatter: extractionResult.kind === "Present",
      },
    );

    return { ok: true, data: document };
  }
}
