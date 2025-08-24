import type { Result } from "../../domain/core/result.ts";
import type { IOError } from "../../domain/shared/errors.ts";

export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export interface FileSystemPort {
  readFile(path: string): Promise<Result<string, IOError>>;
  writeFile(path: string, content: string): Promise<Result<void, IOError>>;
  exists(path: string): Promise<Result<boolean, IOError>>;
  listFiles(
    path: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], IOError>>;
  createDirectory(path: string): Promise<Result<void, IOError>>;
  deleteFile(path: string): Promise<Result<void, IOError>>;
}
