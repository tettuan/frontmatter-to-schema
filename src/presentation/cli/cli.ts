import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { ThreeDomainOrchestrator } from "../../application/coordinators/three-domain-orchestrator.ts";
import { DenoFileReader } from "../../infrastructure/file-system/file-reader.ts";
import { DenoFileWriter } from "../../infrastructure/file-system/file-writer.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { SchemaPath } from "../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";
// For now, not using expandGlob to avoid JSR import issues

/**
 * Minimal CLI for Three Domain Architecture
 * Simplified to focus on the core 3-domain design
 */
export interface CLIArguments {
  readonly schema: string;
  readonly input: string;
  readonly output?: string;
}

export class CLI {
  private fileReader: DenoFileReader;
  private fileWriter: DenoFileWriter;

  private constructor() {
    this.fileReader = new DenoFileReader();
    this.fileWriter = new DenoFileWriter();
  }

  static create(): Result<CLI, DomainError> {
    return ok(new CLI());
  }

  async processCommand(args: CLIArguments): Promise<Result<void, DomainError>> {
    console.log("🚀 Three Domain Architecture CLI");
    console.log("Schema:", args.schema);
    console.log("Input:", args.input);
    console.log("Output:", args.output || "stdout");

    try {
      // Load and parse schema
      const schemaResult = await this.loadSchema(args.schema);
      if (!schemaResult.ok) {
        return err(schemaResult.error);
      }

      // Create file lister that handles glob patterns
      const fileLister = {
        list: (
          pattern: string,
        ): Result<string[], DomainError & { message: string }> => {
          try {
            const files: string[] = [];
            // Use sync version to match the interface
            for (const entry of Deno.readDirSync(".")) {
              if (entry.isFile) {
                const globPattern = new URLPattern({
                  pathname: pattern.replace(/\*\*/g, "*"),
                });
                if (globPattern.test({ pathname: entry.name })) {
                  files.push(entry.name);
                }
              }
            }
            // For now, just list files in the pattern's directory
            const pathParts = pattern.split("/");
            const dir = pathParts.slice(0, -1).join("/") || ".";
            const _filePattern = pathParts[pathParts.length - 1];

            const actualFiles: string[] = [];
            try {
              for (const entry of Deno.readDirSync(dir)) {
                if (entry.isFile && entry.name.includes(".md")) {
                  actualFiles.push(`${dir}/${entry.name}`);
                }
              }
            } catch {
              // Directory doesn't exist, return empty
            }
            return ok(actualFiles);
          } catch (error) {
            return err(createError({
              kind: "ReadFailed",
              path: pattern,
              message: `Failed to list files: ${error}`,
            }));
          }
        },
      };

      // Create orchestrator
      const orchestratorResult = ThreeDomainOrchestrator.create(
        this.fileReader,
        fileLister,
      );
      if (!orchestratorResult.ok) {
        return err(orchestratorResult.error);
      }

      // Process with orchestrator
      const orchestrator = orchestratorResult.data;
      const processResult = await orchestrator.processThreeDomainPipeline({
        inputPattern: args.input,
        schema: schemaResult.data,
        schemaFilePath: args.schema,
      });

      if (!processResult.ok) {
        return err(processResult.error);
      }

      // Write output
      const outputData = processResult.data.processedData;
      const outputJson = JSON.stringify(outputData, null, 2);

      if (args.output) {
        const writeResult = await this.fileWriter.write(
          args.output,
          outputJson,
        );
        if (!writeResult.ok) {
          return err(writeResult.error);
        }
        console.log(`✅ Output written to: ${args.output}`);
      } else {
        console.log(outputJson);
      }

      return ok(void 0);
    } catch (error) {
      return err(createError({
        kind: "EXCEPTION_CAUGHT",
        message: `Unexpected error: ${error}`,
      }));
    }
  }

  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError>> {
    const readResult = await this.fileReader.read(schemaPath);
    if (!readResult.ok) {
      return err(readResult.error);
    }

    try {
      const schemaJson = JSON.parse(readResult.data);

      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return err(pathResult.error);
      }

      const definitionResult = SchemaDefinition.create(schemaJson);
      if (!definitionResult.ok) {
        return err(definitionResult.error);
      }

      return Schema.create(pathResult.data, definitionResult.data);
    } catch (error) {
      return err(createError({
        kind: "ParseError",
        input: readResult.data,
        field: `Invalid schema JSON: ${error}`,
      }));
    }
  }
}
