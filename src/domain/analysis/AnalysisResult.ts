import type { Command } from "../registry/types.ts";

export class AnalysisResult {
  constructor(
    public readonly sourceFile: string,
    public readonly commands: Command[],
    public readonly metadata: Record<string, unknown> = {},
  ) {}

  get isValid(): boolean {
    return this.commands.length > 0;
  }

  merge(other: AnalysisResult): AnalysisResult {
    return new AnalysisResult(
      `${this.sourceFile},${other.sourceFile}`,
      [...this.commands, ...other.commands],
      { ...this.metadata, ...other.metadata },
    );
  }
}
