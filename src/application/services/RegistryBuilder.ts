import type { Command, Registry } from "../../domain/registry/types.ts";
import type { AnalysisResult } from "../../domain/analysis/AnalysisResult.ts";

export class RegistryBuilder {
  private commands: Command[] = [];
  private configs = new Set<string>();

  addAnalysisResult(result: AnalysisResult): void {
    this.commands.push(...result.commands);

    result.commands.forEach((cmd) => {
      this.configs.add(cmd.c1);
    });
  }

  build(): Registry {
    return {
      version: "1.0.0",
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: Array.from(this.configs).sort(),
        commands: this.sortCommands(this.commands),
      },
    };
  }

  private sortCommands(commands: Command[]): Command[] {
    return commands.sort((a, b) => {
      if (a.c1 !== b.c1) return a.c1.localeCompare(b.c1);
      if (a.c2 !== b.c2) return a.c2.localeCompare(b.c2);
      return a.c3.localeCompare(b.c3);
    });
  }
}
