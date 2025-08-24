# TypeScript による Schema一致とテンプレート変換

## アーキテクチャ

TypeScriptによる構造化処理により、Schema展開とマッピングによる確実な変換を実現します。

## 処理フロー

```
入力 → フロントマター抽出 → Schema展開 → マッピング → テンプレート当て込み → 出力
```

## TypeScript処理の詳細

### 1. フロントマター抽出フェーズ

TypeScriptでのYAML処理：

```typescript
import { parse } from "js-yaml";

// フロントマター部分を抽出
const frontMatter = extractFrontMatter(markdown);
const parsedData = parse(frontMatter) as Record<string, unknown>;
```

### 2. Schema展開フェーズ

JSON Schemaを階層化してパス情報を生成：

```typescript
interface SchemaPath {
  path: string; // "tools.commands[].options.input"
  type: string; // "array<string>"
  description?: string; // "Supported input formats"
  required: boolean; // true/false
}

const expandedSchema = expandSchema(jsonSchema);
```

### 3. マッピングフェーズ

フロントマターとSchemaの対応付け：

```typescript
const mappingResult = mapFrontMatterToSchema(
  parsedFrontMatter,
  expandedSchema,
  {
    similarityThreshold: 0.8,
    enforceTypeChecking: true,
    requireAllMandatory: true,
  },
);
```

### 4. テンプレート当て込みフェーズ

TypeScriptによる変数置換処理：

```typescript
// テンプレート内の {SchemaPath} を検出して置換
const processTemplate = (
  template: string,
  mappedData: Record<string, unknown>,
) => {
  return template.replace(/\{([^}]+)\}/g, (match, path) => {
    const value = getValueByPath(mappedData, path);
    if (value === undefined) {
      // 必須項目の場合は警告、任意項目は空文字
      return isRequired(path) ? `[MISSING: ${path}]` : "";
    }
    return formatValue(value, getTypeByPath(path));
  });
};
```

## 利点

1. **予測可能性**: 決定論的な処理結果
2. **デバッグ容易性**: ステップバイステップでの確認可能
3. **パフォーマンス**: 高速な処理
4. **型安全性**: コンパイル時エラー検出
5. **カスタマイズ性**: 細かな処理調整が可能

### Schema一致の確実性

- JSON Schema仕様に完全準拠
- 型検証による確実なマッピング
- 必須項目チェックによるデータ完全性保証

## 実装例

### 完全な処理パイプライン

```typescript
import { SchemaMatchingProcessor } from "./schema-matching-processor";

const processor = new SchemaMatchingProcessor();

const result = await processor.process({
  markdown: inputMarkdown,
  schema: jsonSchema,
  template: templateString,
  options: {
    strictTypeChecking: true,
    warnOnMissingRequired: true,
    similarityThreshold: 0.8,
  },
});

if (result.success) {
  console.log("Processed template:", result.output);
  console.log("Mapping warnings:", result.warnings);
} else {
  console.error("Processing failed:", result.errors);
}
```
