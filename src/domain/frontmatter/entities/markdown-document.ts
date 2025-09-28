import { FilePath } from "../../shared/value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";

/**
 * Document identifier value object.
 */
export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(id: string): DocumentId {
    return new DocumentId(id);
  }

  /**
   * Creates a DocumentId from a file path using the basename without extension.
   */
  static fromPath(path: FilePath): DocumentId {
    const basename = path.getBasename();
    const lastDotIndex = basename.lastIndexOf(".");
    const nameWithoutExt = lastDotIndex > 0 ? basename.substring(0, lastDotIndex) : basename;
    return new DocumentId(nameWithoutExt);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * MarkdownDocument entity representing a markdown file with optional frontmatter.
 * This is an entity in the Frontmatter bounded context.
 */
export class MarkdownDocument {
  private constructor(
    private readonly id: DocumentId,
    private readonly path: FilePath,
    private readonly content: string,
    private readonly frontmatter?: FrontmatterData
  ) {}

  /**
   * Creates a new MarkdownDocument.
   */
  static create(
    id: DocumentId,
    path: FilePath,
    content: string,
    frontmatter?: FrontmatterData
  ): MarkdownDocument {
    return new MarkdownDocument(id, path, content, frontmatter);
  }

  /**
   * Returns the document identifier.
   */
  getId(): DocumentId {
    return this.id;
  }

  /**
   * Returns the file path.
   */
  getPath(): FilePath {
    return this.path;
  }

  /**
   * Returns the full document content including frontmatter.
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Returns the frontmatter data if present.
   */
  getFrontmatter(): FrontmatterData | undefined {
    return this.frontmatter;
  }

  /**
   * Returns true if the document has frontmatter.
   */
  hasFrontmatter(): boolean {
    return this.frontmatter !== undefined;
  }

  /**
   * Returns a new document with updated frontmatter.
   */
  withFrontmatter(frontmatter: FrontmatterData): MarkdownDocument {
    return new MarkdownDocument(this.id, this.path, this.content, frontmatter);
  }

  /**
   * Returns a new document with updated content.
   */
  withContent(content: string): MarkdownDocument {
    return new MarkdownDocument(this.id, this.path, content, this.frontmatter);
  }

  /**
   * Returns only the markdown content, excluding frontmatter.
   * If frontmatter exists, it strips the frontmatter section.
   */
  getMarkdownContent(): string {
    // Simple frontmatter detection and removal
    if (this.content.startsWith("---\n")) {
      const endIndex = this.content.indexOf("\n---\n", 4);
      if (endIndex !== -1) {
        return this.content.substring(endIndex + 5); // Skip "\n---\n"
      }
    }
    return this.content;
  }

  /**
   * Returns true if this is a markdown file based on file extension.
   */
  isMarkdownFile(): boolean {
    return this.path.hasExtension(".md") || this.path.hasExtension(".mdx");
  }

  /**
   * Returns a string representation of the document.
   */
  toString(): string {
    const frontmatterStatus = this.hasFrontmatter() ? "with frontmatter" : "no frontmatter";
    return `MarkdownDocument(${this.id.toString()}, ${this.path.toString()}, ${frontmatterStatus})`;
  }

  /**
   * Compares this document with another for equality based on ID.
   */
  equals(other: MarkdownDocument): boolean {
    return this.id.equals(other.id);
  }
}