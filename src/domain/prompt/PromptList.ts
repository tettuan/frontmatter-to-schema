import type { PromptFile } from "./PromptFile.ts";

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
