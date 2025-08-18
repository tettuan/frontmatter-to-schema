import { FrontMatter } from "./FrontMatter.ts";
import { parse } from "https://deno.land/std@0.220.0/yaml/mod.ts";

export class FrontMatterExtractor {
  private readonly frontMatterRegex = /^---\n([\s\S]*?)\n---/;

  extract(content: string): FrontMatter | null {
    const match = content.match(this.frontMatterRegex);

    if (!match || !match[1]) {
      return null;
    }

    const raw = match[1];

    // Handle empty frontmatter
    if (raw.trim() === "") {
      return new FrontMatter(raw, {});
    }

    try {
      const data = parse(raw) as Record<string, unknown>;
      return new FrontMatter(raw, data || {});
    } catch (error) {
      // Suppress error logging in production
      if (Deno.env.get("DEBUG") === "true") {
        console.error("Failed to parse YAML frontmatter:", error);
      }
      return null;
    }
  }

  hasFrontMatter(content: string): boolean {
    return this.frontMatterRegex.test(content);
  }
}
