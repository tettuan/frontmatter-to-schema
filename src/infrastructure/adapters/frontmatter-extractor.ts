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
    try {
      if (!content.startsWith("---")) {
        return ok({
          frontmatter: "",
          body: content,
        });
      }

      const extracted = extract(content);

      return ok({
        frontmatter: JSON.stringify(extracted.attrs),
        body: extracted.body,
      });
    } catch (error) {
      return err(createError({
        kind: "ExtractionFailed",
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }
}

export class JsonFrontmatterParser implements FrontmatterParser {
  parse(yaml: string): Result<unknown, FrontmatterError & { message: string }> {
    if (!yaml || yaml.trim().length === 0) {
      return ok({});
    }

    try {
      return ok(JSON.parse(yaml));
    } catch (error) {
      return err(createError({
        kind: "InvalidYaml",
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }
}
