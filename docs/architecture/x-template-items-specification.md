# x-template-items Specification

## 概要

`x-template-items`は、requirements.ja.mdとflow.ja.mdに基づき、配列要素展開時のテンプレートを指定するディレクティブである。

## 位置づけと責務

### ドメインと責務

**所属ドメイン**: テンプレート管理ドメイン

**責務**: `{@items}`展開時に使用するテンプレートファイルの指定

### 重要な分離原則

requirements.ja.mdの78-80行目より：

- `$ref`はJSON Schemaの標準機能で、スキーマ構造の再利用にのみ使用
- テンプレート指定は`x-template`と`x-template-items`でのみ行う
- 両者は完全に独立しており、`$ref`はテンプレート処理に影響しない

## 設計原則

### 1. テンプレート指定の集中管理

メインスキーマファイルでテンプレートを一元管理：

```json
// メインスキーマ
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "x-template": "main_template.json",        // メインコンテナ用
  "x-template-items": "item_template.json",  // {@items}展開用
  "properties": {
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "command_schema.json" }  // 構造定義のみ
    }
  }
}

// 参照先スキーマ（command_schema.json）
{
  // x-templateは不要 - メインスキーマで指定済み
  "type": "object",
  "properties": {
    "c1": { "type": "string" },
    "c2": { "type": "string" }
  }
}
```

### 2. 変数解決の起点

flow.ja.mdの61-74行目に基づく：

#### x-template内の変数

- **起点**: Schemaのroot
- **例**: `{version}` → `root.version`

#### x-template-items内の変数

- **起点**: `x-frontmatter-part`指定階層
- **例**: commandsが`x-frontmatter-part`の場合
  - `{c1}` → `commands[].c1`と同義
  - `{description}` → `commands[].description`と同義

## 処理フロー

### 1. {@items}展開のタイミング

flow.ja.mdの57-79行目より：

```mermaid
graph LR
    A[個別ファイル処理] --> B[フロントマター抽出]
    B --> C[全ファイル統合]
    C --> D[x-frontmatter-part配列統合]
    D --> E[データ処理指示]
    E --> F[{@items}配列確定]
    F --> G[x-template-items適用]
    G --> H[各要素を展開]
```

**重要**: `{@items}`は全フロントマターファイルの処理完了後に確定される

### 2. テンプレート処理の流れ

```typescript
// テンプレートエンジン（アプリケーション層）
class TemplateEngine {
  async processItems(data: ProcessedData, schema: Schema): Promise<string[]> {
    // 1. x-template-itemsの取得
    const itemTemplate = schema.extensions["x-template-items"];

    // 2. {@items}配列の取得（データ処理指示ドメイン経由）
    const items = await this.dataProcessor.getItemsArray();

    // 3. 各要素にテンプレート適用
    return items.map((item) => this.renderTemplate(itemTemplate, item));
  }
}
```

## 具体例

### 例1: コマンドレジストリ

```json
// registry_schema.json
{
  "x-template": "registry_template.json",
  "x-template-items": "command_template.json",
  "properties": {
    "tools": {
      "properties": {
        "commands": {
          "type": "array",
          "x-frontmatter-part": true,
          "items": { "$ref": "command_schema.json" }
        }
      }
    }
  }
}

// registry_template.json
{
  "version": "{version}",
  "tools": {
    "commands": ["{@items}"]  // ここで展開
  }
}

// command_template.json（x-template-itemsで指定）
{
  "c1": "{c1}",              // commands[].c1と同義
  "c2": "{c2}",              // commands[].c2と同義
  "description": "{description}"
}
```

### 例2: トレーサビリティ管理

```json
// trace_schema.json
{
  "x-template": "trace_list.yaml",
  "x-template-items": "trace_item.yaml",
  "properties": {
    "traces": {
      "type": "array",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "traceability",  // オプション
      "items": { "type": "string" }
    }
  }
}

// trace_list.yaml
traces:
  {@items}

// trace_item.yaml（x-template-itemsで指定）
- id: {value}
  source: {source}
```

## 処理順序と依存関係

### フェーズ別処理

1. **初期化フェーズ**
   - Schema読取
   - x-template-items指定の抽出（テンプレート管理ドメイン）

2. **個別ファイル処理フェーズ**
   - フロントマター抽出（フロントマター解析ドメイン）
   - x-frontmatter-part配列の識別

3. **統合処理フェーズ**
   - 全ファイルのデータ統合（データ処理指示ドメイン）
   - x-ディレクティブ適用

4. **テンプレート展開フェーズ**
   - x-template-itemsテンプレートの読込（テンプレート管理ドメイン）
   - {@items}配列の各要素に適用（テンプレートエンジン）

## エラーハンドリング

### 起こりうるエラー

```typescript
type TemplateItemsError =
  | { kind: "TemplateNotFound"; path: string }
  | { kind: "InvalidItemsArray"; data: unknown }
  | { kind: "VariableNotFound"; variable: string; context: string };
```

### エラー処理の例

```typescript
function processTemplateItems(
  items: unknown[],
  templatePath: string,
): Result<string[], TemplateItemsError> {
  // テンプレートファイルの存在確認
  if (!exists(templatePath)) {
    return {
      ok: false,
      error: { kind: "TemplateNotFound", path: templatePath },
    };
  }

  // 配列確認
  if (!Array.isArray(items)) {
    return {
      ok: false,
      error: { kind: "InvalidItemsArray", data: items },
    };
  }

  // 各要素の処理
  const results = items.map((item) => renderItem(item, template));
  return { ok: true, data: results };
}
```

## 重要な制約事項

### 1. items階層の省略

flow.ja.md 42-51行目：

- ✅ 正しい: `commands[].c1`
- ❌ 誤り: `commands.items[].c1`

### 2. デフォルト値の非生成

- 存在しないデータの補完は行わない
- 実際のフロントマターデータのみを処理

### 3. テンプレート管理ドメインの責務制限

- テンプレートファイルの管理のみ
- 変数の置換処理は行わない（テンプレートエンジンの責務）

## まとめ

`x-template-items`により、以下が実現される：

1. **設定の簡素化**: メインスキーマでテンプレートを一元管理
2. **責務の明確化**: テンプレート管理ドメインの責務を明確化
3. **独立性の保証**: `$ref`とテンプレート処理の完全な独立
4. **正確な変数解決**: x-frontmatter-part階層を起点とした解決
5. **柔軟な展開**: {@items}による統一的な配列要素処理
