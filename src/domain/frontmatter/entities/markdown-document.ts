import { ok, Result } from "../../shared/types/result.ts";
import { FrontmatterError } from "../../shared/types/errors.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";

export class MarkdownDocument {
  private constructor(
    private readonly path: FilePath,
    private readonly content: string,
    private readonly frontmatter: FrontmatterData,
    private readonly body: string,
  ) {}

  static create(
    path: FilePath,
    content: string,
    frontmatter: FrontmatterData,
    body: string,
  ): Result<MarkdownDocument, FrontmatterError & { message: string }> {
    return ok(new MarkdownDocument(path, content, frontmatter, body));
  }

  getPath(): FilePath {
    return this.path;
  }

  getContent(): string {
    return this.content;
  }

  getFrontmatter(): FrontmatterData {
    return this.frontmatter;
  }

  getBody(): string {
    return this.body;
  }

  hasFrontmatter(): boolean {
    return !this.frontmatter.isEmpty();
  }

  withFrontmatter(frontmatter: FrontmatterData): MarkdownDocument {
    return new MarkdownDocument(
      this.path,
      this.content,
      frontmatter,
      this.body,
    );
  }

  getFileName(): string {
    return this.path.getFileName();
  }

  getDirectory(): string {
    return this.path.getDirectory();
  }
}
