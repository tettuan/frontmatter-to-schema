import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  createError,
  FrontmatterError,
} from "../../domain/shared/types/errors.ts";
import type {
  FrontmatterExtractor,
  FrontmatterParser,
} from "../../domain/frontmatter/index.ts";
import { extract } from "jsr:@std/front-matter/yaml";

export class YamlFrontmatterExtractor implements FrontmatterExtractor {
  extract(content: string): Result<{
    frontmatter: string;
    body: string;
  }, FrontmatterError & { message: string }> {
    if (!content.startsWith("---")) {
      return ok({
        frontmatter: "",
        body: content,
      });
    }

    const extractResult = this.safeExtract(content);
    if (!extractResult.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        message: extractResult.error.message,
      }));
    }

    const jsonResult = this.safeJsonStringify(extractResult.data.attrs);
    if (!jsonResult.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        message: `Failed to serialize frontmatter: ${jsonResult.error.message}`,
      }));
    }

    return ok({
      frontmatter: jsonResult.data,
      body: extractResult.data.body,
    });
  }

  private safeExtract(
    content: string,
  ): Result<{ attrs: unknown; body: string }, { message: string }> {
    try {
      const extracted = extract(content);
      return ok(extracted);
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private safeJsonStringify(
    data: unknown,
  ): Result<string, { message: string }> {
    try {
      return ok(JSON.stringify(data));
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export class JsonFrontmatterParser implements FrontmatterParser {
  parse(yaml: string): Result<unknown, FrontmatterError & { message: string }> {
    if (!yaml || yaml.trim().length === 0) {
      return ok({});
    }

    const parseResult = this.safeJsonParse(yaml);
    if (!parseResult.ok) {
      return err(createError({
        kind: "InvalidYaml",
        message: parseResult.error.message,
      }));
    }

    return ok(parseResult.data);
  }

  private safeJsonParse(content: string): Result<unknown, { message: string }> {
    try {
      return ok(JSON.parse(content));
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
