/**
 * File system operation errors following totality principles.
 */
export type FileError =
  | {
    kind: "FileNotFound";
    path: string;
  }
  | {
    kind: "PermissionDenied";
    path: string;
    operation: "read" | "write";
  }
  | {
    kind: "InvalidPath";
    path: string;
    reason: string;
  }
  | {
    kind: "FileAlreadyExists";
    path: string;
  }
  | {
    kind: "DirectoryNotFound";
    path: string;
  }
  | {
    kind: "IOError";
    path: string;
    message: string;
  };

/**
 * File system information result.
 */
export interface FileInfo {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly mtime: Date | null;
}

/**
 * Directory entry information.
 */
export interface DirectoryEntry {
  readonly name: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

/**
 * Creates a standardized file error with message.
 */
export function createFileError(
  error: FileError,
  customMessage?: string,
): FileError & { message: string } {
  return {
    ...error,
    message: customMessage || getDefaultFileErrorMessage(error),
  };
}

/**
 * Gets default error message for file errors.
 */
function getDefaultFileErrorMessage(error: FileError): string {
  switch (error.kind) {
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "PermissionDenied":
      return `Permission denied for ${error.operation} operation: ${error.path}`;
    case "InvalidPath":
      return `Invalid path "${error.path}": ${error.reason}`;
    case "FileAlreadyExists":
      return `File already exists: ${error.path}`;
    case "DirectoryNotFound":
      return `Directory not found: ${error.path}`;
    case "IOError":
      return `I/O error for ${error.path}: ${error.message}`;
  }
}
