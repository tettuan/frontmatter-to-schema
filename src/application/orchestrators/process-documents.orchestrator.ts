/**
 * Process Documents Orchestrator
 *
 * Coordinates the execution of multiple use cases to process documents
 * Part of the Application Layer orchestrating Domain Services
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { FilePath } from "../../domain/core/file-path.ts";
import { LoadSchemaUseCase } from "../use-cases/load-schema/load-schema.usecase.ts";
import { DiscoverFilesUseCase } from "../use-cases/discover-files/discover-files.usecase.ts";
import { ExtractFrontmatterUseCase } from "../use-cases/extract-frontmatter/extract-frontmatter.usecase.ts";
import { ValidateFrontmatterUseCase } from "../use-cases/validate-frontmatter/validate-frontmatter.usecase.ts";
import { ProcessTemplateUseCase } from "../use-cases/process-template/process-template.usecase.ts";
import { AggregateResultsUseCase } from "../use-cases/aggregate-results/aggregate-results.usecase.ts";
import { WriteOutputUseCase } from "../use-cases/write-output/write-output.usecase.ts";
import { SchemaConstraints } from "../../domain/entities/schema-constraints.ts";
import { SchemaStructureAnalyzer } from "../../domain/schema/services/schema-structure-analyzer.ts";
import { matchProcessingMode } from "../../domain/shared/processing-mode.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import type { ITemplateRepository } from "../../domain/repositories/template-repository.ts";
import { TemplatePath } from "../../domain/repositories/template-repository.ts";
import type { Logger } from "../../domain/shared/logger.ts";
import type { SchemaTemplateInfo } from "../../domain/models/schema-extensions.ts";
import { ArrayBasedProcessor } from "../../domain/aggregation/services/array-based-processor.ts";
import type { FileData } from "../../domain/aggregation/services/array-based-processor.ts";
import * as path from "jsr:@std/path@1.0.9";

/**
 * Input for document processing orchestration
 */
export interface ProcessDocumentsInput {
  schemaPath: string;
  sourcePath: string;
  outputPath?: string;
  format?: "json" | "yaml" | "toml";
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Output from document processing orchestration
 */
export interface ProcessDocumentsOutput {
  filesProcessed: number;
  outputPath?: string;
  result: unknown;
}

/**
 * Process Documents Orchestrator Implementation
 * Coordinates the execution of all document processing use cases
 */
export class ProcessDocumentsOrchestrator {
  private readonly loadSchema: LoadSchemaUseCase;
  private readonly discoverFiles: DiscoverFilesUseCase;
  private readonly extractFrontmatter: ExtractFrontmatterUseCase;
  private readonly validateFrontmatter: ValidateFrontmatterUseCase;
  private readonly processTemplate: ProcessTemplateUseCase;
  private readonly aggregateResults: AggregateResultsUseCase;
  private readonly writeOutput: WriteOutputUseCase;
  private readonly schemaStructureAnalyzer: SchemaStructureAnalyzer;
  private readonly arrayBasedProcessor: ArrayBasedProcessor;

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly templateRepository: ITemplateRepository,
    private readonly logger: Logger,
  ) {
    this.loadSchema = new LoadSchemaUseCase(fileSystem);
    this.discoverFiles = new DiscoverFilesUseCase(fileSystem);
    this.extractFrontmatter = new ExtractFrontmatterUseCase();
    this.validateFrontmatter = new ValidateFrontmatterUseCase();
    this.processTemplate = new ProcessTemplateUseCase();
    this.aggregateResults = new AggregateResultsUseCase();
    this.writeOutput = new WriteOutputUseCase();
    this.schemaStructureAnalyzer = new SchemaStructureAnalyzer();

    // Initialize ArrayBasedProcessor using Smart Constructor pattern
    const processorResult = ArrayBasedProcessor.create();
    if (!processorResult.ok) {
      throw new Error(
        `Failed to create ArrayBasedProcessor: ${processorResult.error.message}`,
      );
    }
    this.arrayBasedProcessor = processorResult.data;
  }

  async execute(
    input: ProcessDocumentsInput,
  ): Promise<
    Result<ProcessDocumentsOutput, DomainError & { message: string }>
  > {
    // Step 1: Load and resolve schema
    if (input.verbose) {
      this.logger.info(`Loading schema from: ${input.schemaPath}`);
    }

    const schemaResult = await this.loadSchema.execute({
      schemaPath: input.schemaPath,
    });

    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Step 1.5: Analyze schema structure for processing strategy
    if (input.verbose) {
      this.logger.info("Analyzing schema structure for processing strategy");
    }

    const filesResult = await this.discoverFiles.execute({
      pattern: input.sourcePath,
    });

    if (!filesResult.ok) {
      return filesResult;
    }

    // Convert file paths to FilePath value objects
    const filePathResults = filesResult.data.files.map((f) =>
      FilePath.create(f)
    );
    const failedPathResults = filePathResults.filter((r) => !r.ok);

    if (failedPathResults.length > 0) {
      const firstError = failedPathResults[0] as {
        error: DomainError & { message: string };
      };
      this.logger.error(`Invalid file path: ${firstError.error.message}`);
      return { ok: false, error: firstError.error };
    }

    const filePaths = filePathResults.map((r) =>
      (r as { data: FilePath }).data
    );

    // Analyze schema structure and determine processing strategy
    const strategyResult = await this.schemaStructureAnalyzer
      .analyzeForProcessing(
        schemaResult.data.schema,
        filePaths,
      );

    if (!strategyResult.ok) {
      return strategyResult;
    }

    const strategy = strategyResult.data;
    if (input.verbose) {
      this.logger.info(`Processing mode: ${strategy.mode.kind}`);
      if (strategy.mode.kind === "ArrayBased") {
        this.logger.info(
          `Array target: ${strategy.mode.targetArray.getPropertyPath()}`,
        );
      }
    }

    // Step 2: Process files based on determined strategy

    // Step 3: Process files based on determined mode
    let actualFilesProcessed = 0;
    const processResult = await matchProcessingMode(
      strategy.mode,
      {
        Individual: async (files) => {
          const result = await this.processIndividualFiles(
            files,
            schemaResult.data,
            input,
          );
          if (result.ok) {
            actualFilesProcessed = result.data.length;
          }
          return result;
        },
        ArrayBased: async (targetArray, files) => {
          const result = await this.processArrayBasedFiles(
            targetArray,
            files,
            schemaResult.data,
            input,
          );
          if (result.ok) {
            // For ArrayBased, the actual count is tracked inside the method
            // We need to access it from the ArrayBasedProcessor result
            actualFilesProcessed = (result as { actualFilesProcessed?: number })
              .actualFilesProcessed || 0;
          }
          return result;
        },
      },
    );

    if (!processResult.ok) {
      return processResult;
    }

    const processedData = processResult.data;

    // Step 4: Aggregate results
    const aggregateResult = await this.aggregateResults.execute({
      data: processedData,
      templateInfo: schemaResult.data.templateInfo,
      schema: schemaResult.data.schema,
    });

    if (!aggregateResult.ok) {
      return aggregateResult;
    }

    // Step 5: Write output if path provided
    let outputPath: string | undefined;

    if (input.outputPath) {
      const writeResult = await this.writeOutput.execute({
        data: aggregateResult.data.aggregated,
        outputPath: input.outputPath,
        format: input.format || "json",
        dryRun: input.dryRun,
      });

      if (!writeResult.ok) {
        return writeResult;
      }

      outputPath = input.outputPath;
    }

    if (input.verbose) {
      this.logger.info(
        `Successfully processed ${strategy.mode.files.length} discovered files`,
      );
    }

    return {
      ok: true,
      data: {
        filesProcessed: actualFilesProcessed,
        outputPath,
        result: aggregateResult.data.aggregated,
      },
    };
  }

  /**
   * Process files in Individual mode (traditional one-to-one processing)
   */
  private async processIndividualFiles(
    files: readonly FilePath[],
    schemaData: { schema: unknown; templateInfo: SchemaTemplateInfo },
    input: ProcessDocumentsInput,
  ): Promise<Result<unknown[], DomainError & { message: string }>> {
    const processedData: unknown[] = [];

    // Extract schema constraints for pre-filtering
    const constraintsResult = SchemaConstraints.extract(schemaData.schema);
    if (!constraintsResult.ok) {
      this.logger.warn(
        `Failed to extract schema constraints: ${constraintsResult.error.message}`,
      );
    }

    for (const filePath of files) {
      const filePathStr = filePath.toString();

      if (input.verbose) {
        this.logger.info(`Processing: ${filePathStr}`);
      }

      // Read file content
      const contentResult = await this.fileSystem.readFile(filePathStr);
      if (!contentResult.ok) {
        this.logger.error(
          `Failed to read ${filePathStr}: ${
            contentResult.error.kind === "FileNotFound"
              ? "File not found"
              : contentResult.error.kind || "Unknown error"
          }`,
        );
        continue;
      }

      // Extract frontmatter
      const extractResult = await this.extractFrontmatter.execute({
        filePath: filePathStr,
        content: contentResult.data,
      });

      if (!extractResult.ok) {
        this.logger.error(
          `Failed to extract from ${filePathStr}: ${extractResult.error.message}`,
        );
        continue;
      }

      // Pre-filter based on schema constraints
      if (constraintsResult.ok) {
        const filterResult = constraintsResult.data.shouldProcessFile(
          extractResult.data.data,
        );
        if (!filterResult.ok) {
          this.logger.error(
            `Failed to evaluate constraints for ${filePathStr}: ${filterResult.error.message}`,
          );
          continue;
        }

        if (!filterResult.data.shouldProcess) {
          if (input.verbose) {
            this.logger.info(
              `Filtered ${filePathStr}: ${
                filterResult.data.reason || "Does not match schema constraints"
              }`,
            );
          }
          continue;
        }

        // Log when file matches constraints
        if (input.verbose) {
          this.logger.info(
            `${filePathStr} matches schema constraints`,
          );
        }
      }

      // Validate frontmatter
      const validateResult = await this.validateFrontmatter.execute({
        data: extractResult.data.data,
        schema: schemaData.schema,
        filePath: filePathStr,
      });

      if (!validateResult.ok) {
        this.logger.error(
          `Validation failed for ${filePathStr}: ${validateResult.error.message}`,
        );
        continue;
      }

      if (!validateResult.data.valid && validateResult.data.validationErrors) {
        this.logger.warn(
          `Validation errors in ${filePathStr}: ${
            validateResult.data.validationErrors.join(", ")
          }`,
        );
      }

      // Process through template
      const templatePathResult = schemaData.templateInfo.getTemplatePath();
      if (!templatePathResult.ok) {
        // No template specified, use raw data
        processedData.push(extractResult.data.data);
        continue;
      }

      // Resolve and process template
      const schemaDir = path.dirname(input.schemaPath);
      const resolvedTemplatePath = path.resolve(
        schemaDir,
        templatePathResult.data,
      );
      const templatePathObj = TemplatePath.create(resolvedTemplatePath);
      if (!templatePathObj.ok) {
        this.logger.error(
          `Invalid template path for ${filePathStr}: ${templatePathObj.error.message}`,
        );
        processedData.push(extractResult.data.data);
        continue;
      }

      const templateResult = await this.templateRepository.load(
        templatePathObj.data,
      );
      if (!templateResult.ok) {
        this.logger.error(
          `Failed to load template for ${filePathStr}: ${
            templateResult.error.kind || "Unknown error"
          }`,
        );
        processedData.push(extractResult.data.data);
        continue;
      }

      const templateProcessResult = await this.processTemplate.execute({
        data: extractResult.data.data,
        template: templateResult.data,
        schemaMode: { kind: "WithSchema", schema: schemaData.schema },
        filePath: filePathStr,
      });

      if (!templateProcessResult.ok) {
        this.logger.error(
          `Template processing failed for ${filePathStr}: ${templateProcessResult.error.message}`,
        );
        processedData.push(extractResult.data.data);
        continue;
      }

      if (input.verbose) {
        this.logger.info(
          `Template applied for ${filePathStr}: ${templateProcessResult.data.metadata.templateApplied}`,
        );
      }

      processedData.push(templateProcessResult.data.transformedData.getData());
    }

    return { ok: true, data: processedData };
  }

  /**
   * Process files in ArrayBased mode (multiple files → single array)
   */
  private async processArrayBasedFiles(
    targetArray:
      import("../../domain/schema/value-objects/array-target.ts").ArrayTarget,
    files: readonly FilePath[],
    schemaData: { schema: unknown; templateInfo: SchemaTemplateInfo },
    input: ProcessDocumentsInput,
  ): Promise<Result<unknown[], DomainError & { message: string }>> {
    if (input.verbose) {
      this.logger.info(
        `Processing ${files.length} files for array target: ${targetArray.getPropertyPath()}`,
      );
    }

    // Step 1: Process individual files to collect data
    const fileData: FileData[] = [];
    const constraintsResult = SchemaConstraints.extract(schemaData.schema);

    if (!constraintsResult.ok) {
      this.logger.warn(
        `Failed to extract schema constraints: ${constraintsResult.error.message}`,
      );
    }

    for (const filePath of files) {
      const filePathStr = filePath.toString();

      if (input.verbose) {
        this.logger.info(`Processing for array: ${filePathStr}`);
      }

      // Read file content
      const contentResult = await this.fileSystem.readFile(filePathStr);
      if (!contentResult.ok) {
        this.logger.error(
          `Failed to read ${filePathStr}: ${
            contentResult.error.kind === "FileNotFound"
              ? "File not found"
              : contentResult.error.kind || "Unknown error"
          }`,
        );
        continue;
      }

      // Extract frontmatter
      const extractResult = await this.extractFrontmatter.execute({
        filePath: filePathStr,
        content: contentResult.data,
      });

      if (!extractResult.ok) {
        this.logger.error(
          `Failed to extract from ${filePathStr}: ${extractResult.error.message}`,
        );
        continue;
      }

      // Pre-filter based on schema constraints (same as individual processing)
      if (constraintsResult.ok) {
        const filterResult = constraintsResult.data.shouldProcessFile(
          extractResult.data.data,
        );
        if (!filterResult.ok) {
          this.logger.error(
            `Failed to evaluate constraints for ${filePathStr}: ${filterResult.error.message}`,
          );
          continue;
        }

        if (!filterResult.data.shouldProcess) {
          if (input.verbose) {
            this.logger.info(
              `Filtered ${filePathStr}: ${
                filterResult.data.reason || "Does not match schema constraints"
              }`,
            );
          }
          continue;
        }

        if (input.verbose) {
          this.logger.info(`${filePathStr} matches schema constraints`);
        }
      }

      // Validate frontmatter
      const validateResult = await this.validateFrontmatter.execute({
        data: extractResult.data.data,
        schema: schemaData.schema,
        filePath: filePathStr,
      });

      if (!validateResult.ok) {
        this.logger.error(
          `Validation failed for ${filePathStr}: ${validateResult.error.message}`,
        );
        continue;
      }

      if (!validateResult.data.valid && validateResult.data.validationErrors) {
        this.logger.warn(
          `Validation errors in ${filePathStr}: ${
            validateResult.data.validationErrors.join(", ")
          }`,
        );
      }

      // Process through template
      let transformedData = extractResult.data.data;
      let templateApplied = false;

      const templatePathResult = schemaData.templateInfo.getTemplatePath();
      if (templatePathResult.ok) {
        // Resolve and process template
        const schemaDir = path.dirname(input.schemaPath);
        const resolvedTemplatePath = path.resolve(
          schemaDir,
          templatePathResult.data,
        );
        const templatePathObj = TemplatePath.create(resolvedTemplatePath);

        if (templatePathObj.ok) {
          const templateResult = await this.templateRepository.load(
            templatePathObj.data,
          );

          if (templateResult.ok) {
            const templateProcessResult = await this.processTemplate.execute({
              data: extractResult.data.data,
              template: templateResult.data,
              schemaMode: { kind: "WithSchema", schema: schemaData.schema },
              filePath: filePathStr,
            });

            if (templateProcessResult.ok) {
              transformedData = templateProcessResult.data.transformedData
                .getData();
              templateApplied = true;

              if (input.verbose) {
                this.logger.info(
                  `Template applied for ${filePathStr}: ${templateProcessResult.data.metadata.templateApplied}`,
                );
              }
            } else {
              this.logger.error(
                `Template processing failed for ${filePathStr}: ${templateProcessResult.error.message}`,
              );
            }
          } else {
            this.logger.error(
              `Failed to load template for ${filePathStr}: ${
                templateResult.error.kind || "Unknown error"
              }`,
            );
          }
        } else {
          this.logger.error(
            `Invalid template path for ${filePathStr}: ${templatePathObj.error.message}`,
          );
        }
      }

      // Add to file data collection
      fileData.push({
        filePath,
        frontmatter: extractResult.data.data,
        templateApplied,
        transformedData,
      });
    }

    // Step 2: Process collected file data into array structure
    const arrayResult = this.arrayBasedProcessor.processFilesToArray(
      targetArray,
      fileData,
    );

    if (!arrayResult.ok) {
      return arrayResult;
    }

    if (input.verbose) {
      this.logger.info(
        `Array processing complete: ${arrayResult.data.filesProcessed} files processed, template application: ${arrayResult.data.metadata.templateApplication}`,
      );
    }

    // Step 3: Create final structure with array data
    const structureResult = this.arrayBasedProcessor.createArrayStructure(
      targetArray,
      arrayResult.data.arrayData,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    // Return the structured result as an array (for compatibility with existing aggregation logic)
    const result: Result<unknown[], DomainError & { message: string }> & {
      actualFilesProcessed?: number;
    } = {
      ok: true,
      data: [structureResult.data],
    };

    // Add the actual file count for tracking in the orchestrator
    result.actualFilesProcessed = arrayResult.data.filesProcessed;

    return result;
  }
}
