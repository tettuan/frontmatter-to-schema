import type { AnalysisResult, MappedEntry } from "./domain/core/types.ts";

/**
 * Claude -p client for analysis
 */
export class ClaudeClient {
  /**
   * Analyzes frontmatter using claude -p
   */
  async analyzeFrontmatter(
    filePath: string,
    fileContent: string,
    extractPromptPath: string,
  ): Promise<AnalysisResult> {
    // Read the prompt template
    const promptTemplate = await Deno.readTextFile(extractPromptPath);

    // Replace placeholders in prompt
    const finalPrompt = promptTemplate
      .replace("{file_path}", filePath)
      .replace("{file_content}", fileContent);

    // Execute claude -p command
    const cmd = new Deno.Command("claude", {
      args: ["-p"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const process = cmd.spawn();

    // Write prompt to stdin
    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(finalPrompt));
    await writer.close();

    // Read response
    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Claude analysis failed: ${errorText}`);
    }

    const responseText = new TextDecoder().decode(stdout);

    try {
      return JSON.parse(responseText) as AnalysisResult;
    } catch (error) {
      throw new Error(
        `Failed to parse Claude response: ${
          error instanceof Error ? error.message : String(error)
        }\nResponse: ${responseText}`,
      );
    }
  }

  /**
   * Maps analysis result to schema using claude -p
   */
  async mapToSchema(
    analysisResult: AnalysisResult,
    mapPromptPath: string,
  ): Promise<MappedEntry> {
    // Read the mapping prompt template
    const promptTemplate = await Deno.readTextFile(mapPromptPath);

    // Replace placeholder with analysis result
    const finalPrompt = promptTemplate.replace(
      "{analysis_result}",
      JSON.stringify(analysisResult, null, 2),
    );

    // Execute claude -p command
    const cmd = new Deno.Command("claude", {
      args: ["-p"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const process = cmd.spawn();

    // Write prompt to stdin
    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(finalPrompt));
    await writer.close();

    // Read response
    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Claude mapping failed: ${errorText}`);
    }

    const responseText = new TextDecoder().decode(stdout);

    try {
      return JSON.parse(responseText) as MappedEntry;
    } catch (error) {
      throw new Error(
        `Failed to parse Claude mapping response: ${
          error instanceof Error ? error.message : String(error)
        }\nResponse: ${responseText}`,
      );
    }
  }
}
