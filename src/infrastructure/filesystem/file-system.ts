import type { Registry } from "../../domain/core/types.ts";
import { PromptFile, PromptList } from "../../domain/services/prompt-models.ts";
import { walk } from "jsr:@std/fs@1/walk";

export class FileReader {
  async readDirectory(path: string): Promise<PromptList> {
    const list = new PromptList();

    for await (
      const entry of walk(path, {
        exts: [".md"],
        includeDirs: false,
      })
    ) {
      const content = await Deno.readTextFile(entry.path);
      const promptFile = new PromptFile(entry.path, content);
      list.add(promptFile);
    }

    return list;
  }

  async readFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

export class FileWriter {
  async writeJson(path: string, data: Registry): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await Deno.writeTextFile(path, json);
  }

  async ensureDir(path: string): Promise<void> {
    await Deno.mkdir(path, { recursive: true });
  }
}
