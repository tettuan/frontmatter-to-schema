// Document Domain Exports
// This module provides document processing capabilities following DDD principles

// Interfaces
export type {
  DocumentError,
  DocumentProcessor,
  ProcessedDocument,
} from "./interfaces/document-processor.ts";

// Services
export { MarkdownDocumentProcessor } from "./services/markdown-document-processor.ts";
