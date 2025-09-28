export { TemplatePath } from "./value-objects/template-path.ts";
export { Template } from "./entities/template.ts";
export type { TemplateData, TemplateFormat } from "./entities/template.ts";
export { TemplateLoader } from "./services/template-loader.ts";
export type { FileSystemOperations } from "./services/template-loader.ts";

// Output Rendering Services (from variable resolution enhancement)
export { OutputRenderingService } from "./services/output-rendering-service.ts";
export type {
  OutputFormat,
  RenderingConfig,
  RenderingContext,
  RenderingResult,
} from "./services/output-rendering-service.ts";

// Items Expansion Services (from {@items} feature)
export { ItemsDetector } from "./services/items-detector.ts";
export type {
  ItemsDetectionResult,
  ItemsPattern,
} from "./services/items-detector.ts";
export { ItemsExpander } from "./services/items-expander.ts";
export type {
  ItemsExpansionContext,
  ItemsExpansionResult,
} from "./services/items-expander.ts";
export { ItemsProcessor } from "./services/items-processor.ts";
export type {
  ItemsProcessingContext,
  ItemsProcessingResult,
  ItemsTemplateLoader,
  TemplateReference,
} from "./services/items-processor.ts";
