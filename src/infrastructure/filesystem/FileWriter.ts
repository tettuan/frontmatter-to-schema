import type { Registry } from "../../domain/core/registry-types.ts";

export class FileWriter {
  async writeJson(path: string, data: Registry): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await Deno.writeTextFile(path, json);
  }

  async ensureDir(path: string): Promise<void> {
    await Deno.mkdir(path, { recursive: true });
  }
}
