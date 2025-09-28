export { SchemaPath } from "./value-objects/schema-path.ts";
export { SchemaDefinition } from "./value-objects/schema-definition.ts";
export { ValidationRules } from "./value-objects/validation-rules.ts";
export { Schema } from "./entities/schema.ts";
export { RefResolver } from "./services/ref-resolver.ts";
export { type SchemaRepository } from "./repositories/schema-repository.ts";
export type {
  ArrayConstraints,
  NumberConstraints,
  ObjectConstraints,
  RefSchema,
  SchemaExtensions,
  SchemaProperties,
  SchemaProperty,
  StringConstraints,
} from "./value-objects/schema-property-types.ts";
export {
  isRefSchema,
  SchemaPropertyFactory,
  SchemaPropertyGuards,
  SchemaPropertyUtils,
} from "./value-objects/schema-property-types.ts";
export type {
  LegacySchemaProperty,
} from "./value-objects/schema-property-migration.ts";
export {
  SchemaPropertyLegacyAdapter,
  SchemaPropertyMigration,
} from "./value-objects/schema-property-migration.ts";
export type { ValidationRule } from "./value-objects/validation-rules.ts";
export type { ResolvedSchema } from "./entities/schema.ts";
export type { SchemaLoader } from "./services/ref-resolver.ts";
export {
  defaultSchemaExtensionRegistry,
  SchemaExtensionKey,
  SchemaExtensionRegistry,
} from "./value-objects/schema-extension-registry.ts";
