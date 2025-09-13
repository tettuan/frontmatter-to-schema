import { err, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";

import { SchemaPath, SchemaRepository } from "../../domain/schema/index.ts";
import {
  FilePath,
  FrontmatterData,
  FrontmatterProcessor,
  MarkdownDocument,
} from "../../domain/frontmatter/index.ts";
import {
  Template,
  TemplatePath,
  TemplateRenderer,
} from "../../domain/template/index.ts";
import { Aggregator, DerivationRule } from "../../domain/aggregation/index.ts";

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

export class ProcessCoordinator {
  constructor(
    private readonly schemaRepo: SchemaRepository,
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly templateRenderer: TemplateRenderer,
    private readonly aggregator: Aggregator,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly fileLister: FileLister,
  ) {}

  processDocuments(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
  ): Result<void, DomainError & { message: string }> {
    const schemaPathResult = SchemaPath.create(schemaPath);
    if (!schemaPathResult.ok) {
      return schemaPathResult;
    }

    const schemaResult = this.schemaRepo.load(schemaPathResult.data);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const resolvedSchemaResult = this.schemaRepo.resolve(schemaResult.data);
    if (!resolvedSchemaResult.ok) {
      return resolvedSchemaResult;
    }

    const schema = resolvedSchemaResult.data;

    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      return filesResult;
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    for (const filePath of filesResult.data) {
      const filePathResult = FilePath.create(filePath);
      if (!filePathResult.ok) {
        continue;
      }

      const contentResult = this.fileReader.read(filePath);
      if (!contentResult.ok) {
        continue;
      }

      const extractResult = this.frontmatterProcessor.extract(
        contentResult.data,
      );
      if (!extractResult.ok) {
        continue;
      }

      const { frontmatter, body } = extractResult.data;

      const validationResult = this.frontmatterProcessor.validate(
        frontmatter,
        schema.getValidationRules(),
      );
      if (!validationResult.ok) {
        continue;
      }

      const docResult = MarkdownDocument.create(
        filePathResult.data,
        contentResult.data,
        validationResult.data,
        body,
      );
      if (!docResult.ok) {
        continue;
      }

      processedData.push(validationResult.data);
      documents.push(docResult.data);
    }

    if (processedData.length === 0) {
      return err(createError({
        kind: "AggregationFailed",
        message: "No valid documents found to process",
      }));
    }

    const frontmatterPartSchema = schema.findFrontmatterPartSchema();
    let finalData: FrontmatterData[];

    if (frontmatterPartSchema) {
      const partResults: FrontmatterData[] = [];
      for (const data of processedData) {
        const parts = this.frontmatterProcessor.extractFromPart(data, "");
        partResults.push(...parts);
      }
      finalData = partResults;
    } else {
      finalData = processedData;
    }

    const derivationRules = schema.getDerivedRules();
    let aggregatedData: FrontmatterData;

    if (derivationRules.length > 0) {
      const rules = derivationRules.map((r) => {
        const ruleResult = DerivationRule.create(
          r.sourcePath,
          r.targetField,
          r.unique,
        );
        return ruleResult.ok ? ruleResult.data : null;
      }).filter((r) => r !== null) as DerivationRule[];

      const aggregationResult = this.aggregator.aggregate(finalData, rules);
      if (!aggregationResult.ok) {
        return aggregationResult;
      }

      const mergeResult = this.aggregator.mergeWithBase(aggregationResult.data);
      if (!mergeResult.ok) {
        return mergeResult;
      }

      aggregatedData = mergeResult.data;
    } else {
      const emptyDataResult = FrontmatterData.create({});
      aggregatedData = emptyDataResult.ok
        ? emptyDataResult.data
        : FrontmatterData.empty();
    }

    const templatePath = schema.getTemplatePath();
    if (!templatePath) {
      return err(createError({
        kind: "InvalidTemplate",
        template: "No template path specified in schema",
      }));
    }

    // Resolve template path relative to schema file directory
    let resolvedTemplatePath = templatePath;
    if (templatePath.startsWith("./")) {
      const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));
      resolvedTemplatePath = schemaDir
        ? `${schemaDir}/${templatePath.substring(2)}`
        : templatePath.substring(2);
    }

    const templatePathResult = TemplatePath.create(resolvedTemplatePath);
    if (!templatePathResult.ok) {
      return templatePathResult;
    }

    const templateContentResult = this.fileReader.read(resolvedTemplatePath);
    if (!templateContentResult.ok) {
      return templateContentResult;
    }

    let templateContent: unknown;
    try {
      templateContent = JSON.parse(templateContentResult.data);
    } catch {
      return err(createError({
        kind: "InvalidTemplate",
        template: templatePath,
      }));
    }

    const templateResult = Template.create(
      templatePathResult.data,
      templateContent,
    );
    if (!templateResult.ok) {
      return templateResult;
    }

    const renderResult = finalData.length > 1
      ? this.templateRenderer.renderWithArray(templateResult.data, finalData)
      : this.templateRenderer.render(templateResult.data, aggregatedData);

    if (!renderResult.ok) {
      return renderResult;
    }

    return this.fileWriter.write(outputPath, renderResult.data);
  }
}
