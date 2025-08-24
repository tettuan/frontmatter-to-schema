export class PromptFile {
  constructor(
    public readonly path: string,
    public readonly content: string,
  ) {}

  get filename(): string {
    return this.path.split("/").pop() || "";
  }

  get hasContent(): boolean {
    return this.content.length > 0;
  }
}
