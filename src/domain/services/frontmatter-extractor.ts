import type { Result } from "../shared/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { DocumentBody, FrontMatter } from "../models/document.ts";

export interface FrontMatterExtractionResult {
  frontMatter: FrontMatter | null;
  body: DocumentBody;
}

export class FrontMatterExtractor {
  private readonly frontMatterRegex = /^---\s*\n([\s\S]*?)---\s*(\n|$)/;

  extract(
    content: string,
  ): Result<FrontMatterExtractionResult, ValidationError> {
    const match = content.match(this.frontMatterRegex);

    if (!match) {
      // No frontmatter found, entire content is body
      return {
        ok: true,
        data: {
          frontMatter: null,
          body: DocumentBody.create(content),
        },
      };
    }

    const rawFrontMatter = match[1];
    const bodyContent = content.slice(match[0].length);

    // Parse the frontmatter
    const parseResult = this.parseFrontMatter(rawFrontMatter);
    if (!parseResult.ok) {
      return parseResult;
    }

    const frontMatterResult = FrontMatter.create(
      rawFrontMatter,
      parseResult.data,
    );

    if (!frontMatterResult.ok) {
      return frontMatterResult;
    }

    return {
      ok: true,
      data: {
        frontMatter: frontMatterResult.data,
        body: DocumentBody.create(bodyContent),
      },
    };
  }

  private parseFrontMatter(
    raw: string,
  ): Result<Record<string, unknown>, ValidationError> {
    try {
      // Simple key-value parsing
      // In production, this would use a proper YAML parser
      const lines = raw.split("\n").filter((line) => line.trim().length > 0);
      const result: Record<string, unknown> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();

          // Handle arrays (simple case)
          if (value.startsWith("[") && value.endsWith("]")) {
            result[key] = value
              .slice(1, -1)
              .split(",")
              .map((v) => v.trim().replace(/^["']|["']$/g, ""));
          } // Handle booleans
          else if (value === "true" || value === "false") {
            result[key] = value === "true";
          } // Handle numbers
          else if (!isNaN(Number(value)) && value !== "") {
            result[key] = Number(value);
          } // Handle strings
          else {
            result[key] = value.replace(/^["']|["']$/g, "");
          }
        }
      }

      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: `Failed to parse frontmatter: ${error}`,
        },
      };
    }
  }
}
