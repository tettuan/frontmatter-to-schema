import { err, ok, Result } from "../../shared/types/result.ts";
import {
  FrontmatterError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../factories/frontmatter-data-factory.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

export interface FrontmatterExtractor {
  extract(content: string): Result<{
    frontmatter: string;
    body: string;
  }, FrontmatterError & { message: string }>;
}

export interface FrontmatterParser {
  parse(yaml: string): Result<unknown, FrontmatterError & { message: string }>;
}

export class FrontmatterProcessor {
  constructor(
    private readonly extractor: FrontmatterExtractor,
    private readonly parser: FrontmatterParser,
  ) {}

  extract(
    content: string,
  ): Result<
    { frontmatter: FrontmatterData; body: string },
    FrontmatterError & { message: string }
  > {
    const extractResult = this.extractor.extract(content);
    if (!extractResult.ok) {
      return extractResult;
    }

    const { frontmatter: yaml, body } = extractResult.data;

    if (!yaml || yaml.trim().length === 0) {
      return ok({
        frontmatter: FrontmatterData.empty(),
        body,
      });
    }

    const parseResult = this.parser.parse(yaml);
    if (!parseResult.ok) {
      return parseResult;
    }

    const dataResult = FrontmatterDataFactory.fromParsedData(parseResult.data);
    if (!dataResult.ok) {
      return dataResult;
    }

    return ok({
      frontmatter: dataResult.data,
      body,
    });
  }

  validate(
    data: FrontmatterData,
    rules: ValidationRules,
  ): Result<FrontmatterData, ValidationError & { message: string }> {
    const validationResult = rules.validate(data.getData());
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    return ok(data);
  }

  extractFromPart(
    data: FrontmatterData,
    partPath: string,
  ): FrontmatterData[] {
    const partDataResult = data.get(partPath);
    if (!partDataResult.ok) {
      return [];
    }

    const partData = partDataResult.data;
    if (!Array.isArray(partData)) {
      return [];
    }

    const results: FrontmatterData[] = [];
    for (const item of partData) {
      const itemResult = FrontmatterDataFactory.fromParsedData(item);
      if (itemResult.ok) {
        results.push(itemResult.data);
      }
    }

    return results;
  }
}
