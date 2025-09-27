/**
 * Schema extension registry - minimal implementation
 */
export const defaultSchemaExtensionRegistry = {
  getExtension: (_name: string) => null,
  hasExtension: (_name: string) => false,
  getTemplateItemsKey: () => ({ getValue: () => "x-template-items" }),
  getJmespathFilterKey: () => ({ getValue: () => "x-jmespath-filter" }),
  getDerivedFromKey: () => ({ getValue: () => "x-derived-from" }),
};
