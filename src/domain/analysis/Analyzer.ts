import type { FrontMatter } from "../frontmatter/FrontMatter.ts";
import { AnalysisResult } from "./AnalysisResult.ts";
import type { Command } from "../core/registry-types.ts";

export interface Analyzer {
  analyze(
    frontMatter: FrontMatter,
    sourceFile: string,
  ): Promise<AnalysisResult>;
}

export class ClaudeAnalyzer implements Analyzer {
  constructor(
    private readonly extractPrompt: string,
    private readonly mappingPrompt: string,
  ) {}

  async analyze(
    frontMatter: FrontMatter,
    sourceFile: string,
  ): Promise<AnalysisResult> {
    const extractedInfo = await this.extractInformation(frontMatter);
    const commands = await this.mapToSchema(extractedInfo, frontMatter);

    return new AnalysisResult(sourceFile, commands);
  }

  private async extractInformation(
    frontMatter: FrontMatter,
  ): Promise<Record<string, unknown>> {
    const prompt = this.extractPrompt
      .replace("{{frontmatter}}", frontMatter.toJson())
      .replace("{{schema}}", this.getSchemaDefinition());

    return await this.callClaude(prompt);
  }

  private async mapToSchema(
    extractedInfo: Record<string, unknown>,
    frontMatter: FrontMatter,
  ): Promise<Command[]> {
    const prompt = this.mappingPrompt
      .replace("{{extracted}}", JSON.stringify(extractedInfo))
      .replace("{{frontmatter}}", frontMatter.toJson())
      .replace("{{schema}}", this.getSchemaDefinition());

    const result = await this.callClaude(prompt);
    return this.parseCommands(result);
  }

  private async callClaude(prompt: string): Promise<Record<string, unknown>> {
    const tempFile = await Deno.makeTempFile({ suffix: ".txt" });
    await Deno.writeTextFile(tempFile, prompt);

    const command = new Deno.Command("claude", {
      args: ["-p", tempFile],
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, stderr } = await command.output();
    await Deno.remove(tempFile);

    if (stderr.length > 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Claude API error: ${errorText}`);
    }

    const output = new TextDecoder().decode(stdout);
    try {
      return JSON.parse(output) as Record<string, unknown>;
    } catch {
      return { raw: output };
    }
  }

  private parseCommands(data: unknown): Command[] {
    if (Array.isArray(data)) {
      return data as Command[];
    }
    const dataObj = data as Record<string, unknown>;
    if (dataObj.commands && Array.isArray(dataObj.commands)) {
      return dataObj.commands as Command[];
    }
    return [];
  }

  private getSchemaDefinition(): string {
    return JSON.stringify(
      {
        command: {
          c1: "string (domain/category)",
          c2: "string (action/directive)",
          c3: "string (target/layer)",
          description: "string",
          usage: "string (optional)",
          options: {
            input: "string[] (optional)",
            adaptation: "string[] (optional)",
            input_file: "boolean[] (optional)",
            stdin: "boolean[] (optional)",
            destination: "boolean[] (optional)",
          },
        },
      },
      null,
      2,
    );
  }
}
