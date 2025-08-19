import { Result } from "../shared/result.ts";
import { ValidationError } from "../shared/errors.ts";

export class DocumentPath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<DocumentPath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Document path cannot be empty",
        },
      };
    }
    return { ok: true, data: new DocumentPath(path.trim()) };
  }

  getValue(): string {
    return this.value;
  }

  getFileName(): string {
    return this.value.split("/").pop() || "";
  }

  getDirectory(): string {
    const parts = this.value.split("/");
    parts.pop();
    return parts.join("/");
  }
}

export class FrontMatter {
  private constructor(
    private readonly raw: string,
    private readonly parsed: Record<string, unknown>,
  ) {}

  static create(
    raw: string,
    parsed: Record<string, unknown>,
  ): Result<FrontMatter, ValidationError> {
    // Allow empty frontmatter (raw can be empty string)
    // Only reject if raw is null or undefined
    if (raw === null || raw === undefined) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Frontmatter cannot be null or undefined",
        },
      };
    }
    return { ok: true, data: new FrontMatter(raw, parsed) };
  }

  getRaw(): string {
    return this.raw;
  }

  getParsed(): Record<string, unknown> {
    return { ...this.parsed };
  }

  getField(key: string): unknown {
    return this.parsed[key];
  }
}

export class DocumentBody {
  private constructor(private readonly content: string) {}

  static create(content: string): DocumentBody {
    return new DocumentBody(content);
  }

  getContent(): string {
    return this.content;
  }

  getLength(): number {
    return this.content.length;
  }
}

export class Document {
  private constructor(
    private readonly path: DocumentPath,
    private readonly frontMatter: FrontMatter | null,
    private readonly body: DocumentBody,
  ) {}

  static create(
    path: DocumentPath,
    frontMatter: FrontMatter | null,
    body: DocumentBody,
  ): Document {
    return new Document(path, frontMatter, body);
  }

  getPath(): DocumentPath {
    return this.path;
  }

  getFrontMatter(): FrontMatter | null {
    return this.frontMatter;
  }

  getBody(): DocumentBody {
    return this.body;
  }

  hasFrontMatter(): boolean {
    return this.frontMatter !== null;
  }
}