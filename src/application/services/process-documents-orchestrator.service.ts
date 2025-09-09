/**
 * Process Documents Orchestrator Service
 *
 * @deprecated ARCHITECTURAL VIOLATION: This service bypasses template processing
 *
 * CRITICAL ISSUE: This implementation violates the canonical processing path by:
 * 1. Bypassing the mandatory template transformation phase
 * 2. Processing raw frontmatter data without template integration
 * 3. Violating the Single Path Rule established in architectural documentation
 *
 * REQUIRED ACTION: All document processing must route through DocumentProcessor
 * which properly integrates the UnifiedTemplateProcessor for template transformation.
 *
 * SEE: docs/architecture/canonical-processing-paths.md
 * SEE: Issue #592 - Template Processing Integrity Violation
 *
 * This class will be removed in favor of the canonical DocumentProcessor path.
 */

import type { Result } from "../../domain/core/result.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import type { ProcessDocumentsInput } from "../value-objects/process-documents-input.value-object.ts";
import { ProcessDocumentsOutput } from "../value-objects/process-documents-output.value-object.ts";
import type { ProcessDocumentsOptions } from "../value-objects/process-documents-options.value-object.ts";
import { SchemaLoadingService } from "./schema-loading.service.ts";
import { FileDiscoveryService } from "./file-discovery.service.ts";
import { MarkdownProcessingService } from "./markdown-processing.service.ts";
import { ResultAggregationService } from "./result-aggregation.service.ts";
import { OutputWritingService } from "./output-writing.service.ts";

/**
 * Process Documents Orchestrator Service - Coordinates the entire document processing workflow
 */
export class ProcessDocumentsOrchestratorService {
  private readonly schemaLoadingService: SchemaLoadingService;
  private readonly fileDiscoveryService: FileDiscoveryService;
  private readonly markdownProcessingService: MarkdownProcessingService;
  private readonly resultAggregationService: ResultAggregationService;
  private readonly outputWritingService: OutputWritingService;

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly options: ProcessDocumentsOptions,
  ) {
    // ARCHITECTURAL VIOLATION WARNING
    console.warn(
      "🚨 ARCHITECTURAL VIOLATION: ProcessDocumentsOrchestrator bypasses template processing!",
    );
    console.warn("   This violates the canonical processing path requirement.");
    console.warn(
      "   Use DocumentProcessor instead for proper template integration.",
    );
    console.warn(
      "   See Issue #592 and docs/architecture/canonical-processing-paths.md",
    );

    this.schemaLoadingService = new SchemaLoadingService(fileSystem);
    this.fileDiscoveryService = new FileDiscoveryService();
    this.markdownProcessingService = new MarkdownProcessingService();
    this.resultAggregationService = new ResultAggregationService();
    this.outputWritingService = new OutputWritingService(fileSystem);
  }

  /**
   * Execute the complete document processing workflow
   */
  async execute(
    input: ProcessDocumentsInput,
  ): Promise<
    Result<
      ProcessDocumentsOutput,
      { kind: string; message: string; details?: unknown }
    >
  > {
    const warnings: string[] = [];

    try {
      // Phase 0: Load and resolve schema
      if (this.options.isVerbose()) {
        console.log(`Loading schema from: ${input.getSchemaPath()}`);
      }

      const schemaResult = await this.schemaLoadingService.loadAndResolveSchema(
        input.getSchemaPath(),
      );
      if (!schemaResult.ok) {
        return schemaResult;
      }

      const { schema, templateInfo } = schemaResult.data;

      // Phase 1: Discover files
      if (this.options.isVerbose()) {
        console.log(`Scanning for files matching: ${input.getInputPattern()}`);
      }

      const filesResult = await this.fileDiscoveryService.findMarkdownFiles(
        input.getInputPattern(),
      );
      if (!filesResult.ok) {
        return filesResult;
      }

      const files = filesResult.data;
      if (files.length === 0) {
        return {
          ok: false,
          error: {
            kind: "NoFilesFound",
            message:
              `No files found matching pattern: ${input.getInputPattern()}`,
          },
        };
      }

      if (this.options.isVerbose()) {
        console.log(`Found ${files.length} files to process`);
      }

      // Phase 2: Process each file
      const processedData: unknown[] = [];
      const processingErrors: string[] = [];

      for (const file of files) {
        if (this.options.isVerbose()) {
          console.log(`Processing: ${file}`);
        }

        const result = await this.markdownProcessingService.processMarkdownFile(
          file,
          schema,
        );
        if (result.ok) {
          processedData.push(result.data);
        } else {
          const errorMsg = `${file}: ${result.error.message}`;
          if (this.options.isVerbose()) {
            console.warn(errorMsg);
          }
          processingErrors.push(errorMsg);
        }
      }

      if (processedData.length === 0) {
        return {
          ok: false,
          error: {
            kind: "NoDataProcessed",
            message: "No files were successfully processed",
            details: processingErrors,
          },
        };
      }

      if (processingErrors.length > 0) {
        warnings.push(
          ...processingErrors.map((err) => `Processing error: ${err}`),
        );
      }

      if (this.options.isVerbose()) {
        console.log(
          `Processed ${processedData.length} files successfully, ${processingErrors.length} failed`,
        );
      }

      // Phase 3: Aggregate results with derivation rules
      if (this.options.isVerbose()) {
        console.log("Applying aggregation and derivation rules...");
      }

      const aggregationResult = this.resultAggregationService.aggregateResults(
        processedData,
        templateInfo,
      );
      if (!aggregationResult.ok) {
        return aggregationResult;
      }

      const finalData = aggregationResult.data;

      // Phase 4: Write output (skip if dry run)
      if (this.options.isDryRun()) {
        if (this.options.isVerbose()) {
          console.log("Dry run mode: Skipping output write");
        }
      } else {
        if (this.options.isVerbose()) {
          console.log(`Writing output to: ${input.getOutputPath()}`);
        }

        const writeResult = await this.outputWritingService.writeOutput(
          finalData,
          input.getOutputPath(),
          input.getOutputFormat(),
        );
        if (!writeResult.ok) {
          return writeResult;
        }
      }

      // Create and return result
      const outputResult = ProcessDocumentsOutput.create({
        processedCount: processedData.length,
        outputPath: input.getOutputPath(),
        warnings,
      });

      if (!outputResult.ok) {
        return {
          ok: false,
          error: {
            kind: "OutputCreationError",
            message: `Failed to create output: ${outputResult.error.message}`,
          },
        };
      }

      return {
        ok: true,
        data: outputResult.data,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "UnexpectedError",
          message: error instanceof Error
            ? `Unexpected error during processing: ${error.message}`
            : "Unexpected error during processing",
          details: error,
        },
      };
    }
  }
}
