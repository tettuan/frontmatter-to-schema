import { PromptFile } from "../../domain/prompt/PromptFile.ts";
import { PromptList } from "../../domain/prompt/PromptList.ts";
import { walk } from "https://deno.land/std@0.220.0/fs/walk.ts";

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
