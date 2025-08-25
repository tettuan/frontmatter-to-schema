import { AnalysisResult, type Command, type Registry } from "../../domain/core/types.ts";

export class RegistryAggregator {
  private commands: Command[] = [];
  private configs = new Set<string>();

  addAnalysisResult(result: AnalysisResult): void {
    // AnalysisResult now has generic data property that could be Command[]
    const commands = result.data as Command[];
    if (Array.isArray(commands)) {
      this.commands.push(...commands);
      
      commands.forEach((cmd: Command) => {
        this.configs.add(cmd.c1);
      });
    }
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
