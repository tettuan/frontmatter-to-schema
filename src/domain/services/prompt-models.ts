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

export class PromptList {
  private files: PromptFile[] = [];

  add(file: PromptFile): void {
    this.files.push(file);
  }

  getAll(): PromptFile[] {
    return [...this.files];
  }

  get count(): number {
    return this.files.length;
  }

  filter(predicate: (file: PromptFile) => boolean): PromptFile[] {
    return this.files.filter(predicate);
  }
}
