# Schemaドメイン

## Schema処理アーキテクチャ

Schema処理は以下の2つのレイヤーで構成される：

### Layer 0: Schema変換 (yaml-schema-mapper)

**目的**: 生フロントマターをSchema定義に基づいて変換

**処理内容**:

- プロパティ名マッピング（`x-map-from` ディレクティブの処理）
- 型変換（array ↔ single value, string → number/boolean など）
- Schema検証（required, enum, pattern など）

**適用タイミング**: フロントマター抽出直後、x-* ディレクティブ処理の前

**モジュール**: `sub_modules/yaml-schema-mapper/`

**重要**: Layer 0 は Schema ドメインではなく Frontmatter ドメインで実行されるが、
Schema定義を参照するため Schema ドメインの概念的な一部として扱う。

### Layer 1: ディレクティブ処理

**目的**: Schema定義内の x-* ディレクティブを処理

**処理内容**:

- x-frontmatter-part: 対象配列の特定
- x-flatten-arrays: 配列フラット化
- x-derived-from: 値の集約（data-path-resolver 使用）
- x-derived-unique: 重複削除
- x-template-\*: テンプレート指定

**適用タイミング**: Layer 0 完了後

---

## Schema拡張プロパティ (x-*)

本アプリケーション特有のSchema拡張プロパティを定義する。これらは標準JSON
Schemaに加えて、アプリケーション固有の機能を提供する。

### x-map-from (Layer 0 処理)

**処理レイヤー**: Layer 0 (yaml-schema-mapper)

プロパティ名の明示的なマッピングを指定。生フロントマターのプロパティ名とSchema定義のプロパティ名が異なる場合に使用。

**形式**: string | string[] (fallback)

```json
{
  "properties": {
    "input_file": {
      "type": "boolean",
      "x-map-from": "file"  // "file" → "input_file" へマッピング
    },
    "displayName": {
      "type": "string",
      "x-map-from": ["fullName", "name", "userName"]  // フォールバック
    }
  }
}
```

**処理タイミング**: Stage 0 (yaml-schema-mapper による変換時)

**フォールバック動作**:

- 配列で指定された場合、先頭から順に検索
- 最初に見つかった値を使用
- すべて見つからない場合は undefined

**重要**: x-map-from は他の x-\* ディレクティブより前に処理される。

### x-template

テンプレートファイルの指定。Schemaから使用するテンプレートファイル名を指定する。

詳細な処理ルールについては
[Mapping Hierarchy Rules](../architecture/mapping-hierarchy-rules.md) を参照。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "registry_template.json",
  "properties": {
    // ...
  }
}
```

### x-frontmatter-part

フロントマター処理の対象配列を指定。`true`
が設定された配列は個別のマークダウンファイル処理に使用される。

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": { "$ref": "registry_command_schema.json" }
  }
}
```

### x-derived-from

集約処理での派生フィールドのソース指定。特定の階層から値を集約して新しいフィールドを生成する。

```json
{
  "availableConfigs": {
    "type": "array",
    "x-derived-from": "commands[].c1",
    "x-derived-unique": true,
    "items": { "type": "string" }
  }
}
```

### x-derived-unique

派生フィールドの値を一意化するかを指定。`x-derived-from`
と組み合わせて使用する。

### x-flatten-arrays

フロントマター内部のネストした配列構造をフラット化し、テンプレート処理用の均一な配列を生成する。指定時のみ適用されるオプション機能。

```json
{
  "items": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability",
    "x-template-items": "item_template.json"
  }
}
```

**特徴:**

- 指定時のみ適用される配列フラット化機能
- デフォルトではフロントマター構造をそのまま保持
- Stage 2で処理（`x-frontmatter-part`の後）

## 値オブジェクト

### FlattenArraysDirective

`x-flatten-arrays`ディレクティブを表現する値オブジェクト。フラット化対象プロパティと処理オプションを管理する。

```typescript
export class FlattenArraysDirective {
  private constructor(
    private readonly targetPropertyName: string,
    private readonly sourcePropertyName: string,
    private readonly isOptional: boolean,
  ) {}

  static create(
    targetProperty: string,
    sourceProperty: string,
  ): Result<FlattenArraysDirective, DomainError> {
    // プロパティ名の妥当性検証
  }

  isApplicable(): boolean {
    // フラット化処理の適用可否を判定
  }
}
```

**責務:**

- ディレクティブの妥当性検証
- フラット化対象プロパティの管理
- オプション処理の制御

### SchemaPath

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
