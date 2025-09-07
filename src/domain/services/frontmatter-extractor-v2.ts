/**
 * Frontmatter Extractor V2
 *
 * Simplified frontmatter extraction service that extracts
 * frontmatter from Markdown files in various formats.
 */

import type { Result } from "../core/result.ts";

/**
 * Extracted frontmatter data
 */
export interface ExtractedFrontmatter {
  content: string;
  format: "yaml" | "json" | "toml";
}

/**
 * Service for extracting frontmatter from Markdown content
 */
export class FrontmatterExtractor {
  /**
   * Extract frontmatter from Markdown content
   */
  extract(
    content: string,
  ): Result<ExtractedFrontmatter, { kind: string; message: string }> {
    if (!content || content.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyContent",
          message: "Content cannot be empty",
        },
      };
    }

    // Try to detect frontmatter format
    const lines = content.split("\n");

    // Check for YAML frontmatter (---)
    if (lines[0] === "---") {
      return this.extractYAMLFrontmatter(lines);
    }

    // Check for TOML frontmatter (+++)
    if (lines[0] === "+++") {
      return this.extractTOMLFrontmatter(lines);
    }

    // Check for JSON frontmatter (starts with {)
    if (lines[0].trim().startsWith("{")) {
      return this.extractJSONFrontmatter(content);
    }

    return {
      ok: false,
      error: {
        kind: "NoFrontmatterFound",
        message: "No frontmatter delimiter found in content",
      },
    };
  }

  /**
   * Extract YAML frontmatter (delimited by ---)
   */
  private extractYAMLFrontmatter(
    lines: string[],
  ): Result<ExtractedFrontmatter, { kind: string; message: string }> {
    const frontmatterLines: string[] = [];
    let foundEnd = false;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        foundEnd = true;
        break;
      }
      frontmatterLines.push(lines[i]);
    }

    if (!foundEnd) {
      return {
        ok: false,
        error: {
          kind: "InvalidFrontmatter",
          message: "YAML frontmatter is not properly closed with ---",
        },
      };
    }

    if (frontmatterLines.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyFrontmatter",
          message: "YAML frontmatter is empty",
        },
      };
    }

    return {
      ok: true,
      data: {
        content: frontmatterLines.join("\n"),
        format: "yaml",
      },
    };
  }

  /**
   * Extract TOML frontmatter (delimited by +++)
   */
  private extractTOMLFrontmatter(
    lines: string[],
  ): Result<ExtractedFrontmatter, { kind: string; message: string }> {
    const frontmatterLines: string[] = [];
    let foundEnd = false;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "+++") {
        foundEnd = true;
        break;
      }
      frontmatterLines.push(lines[i]);
    }

    if (!foundEnd) {
      return {
        ok: false,
        error: {
          kind: "InvalidFrontmatter",
          message: "TOML frontmatter is not properly closed with +++",
        },
      };
    }

    if (frontmatterLines.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyFrontmatter",
          message: "TOML frontmatter is empty",
        },
      };
    }

    return {
      ok: true,
      data: {
        content: frontmatterLines.join("\n"),
        format: "toml",
      },
    };
  }

  /**
   * Extract JSON frontmatter (JSON object at start)
   */
  private extractJSONFrontmatter(
    content: string,
  ): Result<ExtractedFrontmatter, { kind: string; message: string }> {
    // Try to find a complete JSON object at the start
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEnd = -1;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    if (jsonEnd === -1) {
      return {
        ok: false,
        error: {
          kind: "InvalidFrontmatter",
          message: "JSON frontmatter is not properly closed",
        },
      };
    }

    const jsonContent = content.substring(0, jsonEnd).trim();

    // Verify it's valid JSON
    try {
      JSON.parse(jsonContent);
    } catch {
      return {
        ok: false,
        error: {
          kind: "InvalidJSON",
          message: "Frontmatter is not valid JSON",
        },
      };
    }

    return {
      ok: true,
      data: {
        content: jsonContent,
        format: "json",
      },
    };
  }
}
