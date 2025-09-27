// Three Domain Orchestrator
export { ThreeDomainOrchestrator } from "./coordinators/three-domain-orchestrator.ts";
export type {
  ProcessingConfiguration,
  ThreeDomainProcessingResult,
} from "./coordinators/three-domain-orchestrator.ts";

// File system interfaces (simple definitions)
export interface FileWriter {
  write(
    path: string,
    content: string,
  ): import("../domain/shared/types/result.ts").Result<
    void,
    import("../domain/shared/types/errors.ts").FileSystemError & {
      message: string;
    }
  >;
}

export interface FileReader {
  read(
    path: string,
  ): import("../domain/shared/types/result.ts").Result<
    string,
    import("../domain/shared/types/errors.ts").FileSystemError & {
      message: string;
    }
  >;
}

export interface FileLister {
  list(
    pattern: string,
  ): import("../domain/shared/types/result.ts").Result<
    string[],
    import("../domain/shared/types/errors.ts").FileSystemError & {
      message: string;
    }
  >;
}

// Re-export infrastructure components that are used by application
export { DenoFileReader } from "../infrastructure/file-system/file-reader.ts";
export { DenoFileWriter } from "../infrastructure/file-system/file-writer.ts";
