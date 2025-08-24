import { parse } from "jsr:@std/yaml@1";

export class FrontMatter {
  constructor(
    public readonly raw: string,
    public readonly data: Record<string, unknown>,
  ) {}

  get(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  toJson(): string {
    return JSON.stringify(this.data, null, 2);
  }
}

export class FrontMatterExtractor {
  private readonly frontMatterRegex = /^---\n([\s\S]*?)---/;

  extract(content: string): FrontMatter | null {
    const match = content.match(this.frontMatterRegex);

    if (!match || match[1] === undefined) {
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
    } catch (_error) {
      // Return null for invalid YAML
      return null;
    }
  }

  hasFrontMatter(content: string): boolean {
    return this.frontMatterRegex.test(content);
  }
}
