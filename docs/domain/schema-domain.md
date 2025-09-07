# Schemaドメイン

## 値オブジェクト

```typescript
export class SchemaPath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<SchemaPath, SchemaPathError> {
    if (!path.endsWith(".json")) {
      return { ok: false, error: { kind: "InvalidExtension", path } };
    }
    return { ok: true, data: new SchemaPath(path) };
  }
}
```

## エンティティ

```typescript
export type SchemaState =
  | { kind: "Unloaded"; path: SchemaPath }
  | { kind: "Loading"; path: SchemaPath }
  | { kind: "Resolved"; path: SchemaPath; schema: ResolvedSchema }
  | { kind: "Failed"; path: SchemaPath; error: SchemaError };

export class Schema {
  private state: SchemaState;

  static create(id: SchemaId, path: SchemaPath): Schema {
    return new Schema(id, { kind: "Unloaded", path });
  }
}
```
