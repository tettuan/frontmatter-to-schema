import type { DomainError, Result } from "../../domain/core/result.ts";

// File System Port
export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export interface FileSystemPort {
  readFile(path: string): Promise<Result<string, DomainError>>;
  writeFile(path: string, content: string): Promise<Result<void, DomainError>>;
  exists(path: string): Promise<Result<boolean, DomainError>>;
  listFiles(
    path: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], DomainError>>;
  createDirectory(path: string): Promise<Result<void, DomainError>>;
  deleteFile(path: string): Promise<Result<void, DomainError>>;
}
