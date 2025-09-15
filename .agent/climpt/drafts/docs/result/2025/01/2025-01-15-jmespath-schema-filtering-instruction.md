---
title: "JMESPath Schema-Embedded Filtering Implementation Guide"
version: "1.0"
date: "2025-01-15"
variables:
  - uv-schema-path: "Path to the JSON schema file containing JMESPath filter expressions"
  - uv-frontmatter-data: "Source frontmatter data to be filtered"
  - uv-filter-expression: "JMESPath expression for data filtering"
---

# JMESPath Schema-Embedded Filtering Implementation Guide

## 0. 目的・適用範囲

- **目的**: JSON
  Schema内にJMESPath式を埋め込み、フロントマターデータの動的フィルタリングを実現する機能の実装と運用指示書
- **適用範囲**:
  frontmatter-to-schemaプロジェクトにおけるスキーマベースデータフィルタリング機能の実装、テスト、運用
- **非適用範囲**:
  JMESPath言語仕様の変更、外部ライブラリの修正、レガシースキーマフォーマットのサポート

## 1. 不変条件（壊してはならない性質）

1. **型安全性**:
   全てのJMESPath操作はResult<T,E>パターンでラップされ、例外は発生しない
2. **DDD原則遵守**:
   ドメインロジックは適切な境界内に配置され、インフラストラクチャ層への依存は注入される
3. **Totality原則**:
   部分関数は全関数に変換され、全ての実行パスで明示的な結果を返す
4. **スキーマ互換性**: 既存のJSON Schemaとの100%後方互換性を維持
5. **パフォーマンス**: JMESPathフィルタリングによる処理遅延は元処理時間の20%以下

## 2. 前提情報リスト

### 2.1 プロジェクト基盤

- **言語・ランタイム**: TypeScript on Deno (JSR package management)
- **アーキテクチャ**: Domain-Driven Design with Bounded Contexts
- **エラーハンドリング**: Result<T,E> pattern for total functions
- **テスト戦略**: TDD with unit/integration/e2e test coverage

### 2.2 JMESPath実装詳細

- **依存ライブラリ**: `@halvardm/jmespath@^0.17.0` (JSR経由)
- **フィルタ拡張**: `x-jmespath-filter` custom JSON Schema extension
- **データフロー**: FrontmatterData → JMESPathFilterService → FilteredData
- **エラー分類**: Compilation errors / Execution errors / Result validation
  errors

### 2.3 実装済みコンポーネント

- **JMESPathFilterService**: Core filtering logic with @halvardm/jmespath
  integration
- **SchemaDefinition extensions**: hasJMESPathFilter() / getJMESPathFilter()
  methods
- **SchemaProcessingService**: Integration points for schema-level and
  property-level filtering
- **FrontmatterData extensions**: getAllKeys() method for recursive key
  extraction
- **Comprehensive test suite**: 35+ test cases covering unit and integration
  scenarios

## 3. 概要

JMESPath式をJSON
Schemaの`x-jmespath-filter`拡張プロパティに埋め込み、スキーマレベルでフロントマターデータの動的フィルタリングを実現します。この機能により、データ取得時点でJMESPath式による選択・変換・集約が可能となり、テンプレート生成の柔軟性が大幅に向上します。実装はDDD原則とTotality原則に従い、型安全性と例外処理の完全性を保証します。

## 4. 指示内容

### 4.1 Git ブランチ準備

- Gitブランチ準備:
  `echo "JMESPath schema filtering feature" | climpt-git decide-branch working-branch`
  を実行し、出力結果の指示に従う。

### 4.2 スキーマ拡張の理解

JSON
Schemaに`x-jmespath-filter`拡張を追加することで、データフィルタリングを宣言的に定義します。

```json
{
  "type": "object",
  "properties": {
    "commands": {
      "type": "array",
      "x-jmespath-filter": "commands[?c1 == 'git']",
      "items": {
        "type": "object",
        "properties": {
          "c1": { "type": "string" },
          "c2": { "type": "string" },
          "c3": { "type": "string" }
        }
      }
    }
  },
  "x-jmespath-filter": "project.dependencies[?type == 'prod'].name"
}
```

### 4.3 フィルタサービスの利用

JMESPathFilterServiceを使用してデータフィルタリングを実行します：

```typescript
const jmespathServiceResult = JMESPathFilterService.create();
if (!jmespathServiceResult.ok) {
  return jmespathServiceResult; // Error handling
}

const filterResult = jmespathServiceResult.data.applyFilter(
  frontmatterData,
  "commands[?active == true]",
);

if (!filterResult.ok) {
  // Handle compilation or execution errors
  console.error("JMESPath filtering failed:", filterResult.error.message);
  return filterResult;
}

const filteredData = filterResult.data;
```

### 4.4 スキーマレベル統合

SchemaProcessingServiceを通じてスキーマベースのフィルタリングを統合します：

```typescript
const schemaProcessingService = new SchemaProcessingService(
  schemaRepository,
  basePropertyPopulator,
  jmespathFilterService,
);

// Apply schema-level filtering
const filteredDataResult = schemaProcessingService.applyJMESPathFiltering(
  frontmatterData,
  schema,
);

// Apply property-level filtering
const propertyFilteredResult = schemaProcessingService
  .applyPropertyJMESPathFiltering(
    frontmatterData,
    "commands",
    schema,
  );
```

### 4.5 エラーハンドリング戦略

全てのJMESPath操作は型安全なエラーハンドリングを実装します：

```typescript
type JMESPathFilterError =
  | { kind: "JMESPathCompilationFailed"; expression: string; message: string }
  | { kind: "JMESPathExecutionFailed"; expression: string; message: string }
  | { kind: "InvalidJMESPathResult"; expression: string; result: unknown };

// Error handling example
if (!filterResult.ok) {
  switch (filterResult.error.kind) {
    case "JMESPathCompilationFailed":
      // Handle syntax errors in JMESPath expressions
      break;
    case "JMESPathExecutionFailed":
      // Handle runtime errors during filtering
      break;
    case "InvalidJMESPathResult":
      // Handle unexpected result types
      break;
  }
}
```

### 4.6 テスト実装要件

新機能のテストは以下の構造で実装します：

1. **Unit Tests**: JMESPathFilterService単体機能テスト
2. **Integration Tests**: SchemaProcessingServiceとの統合テスト
3. **Schema Parsing Tests**: スキーマ拡張の解析テスト
4. **Error Handling Tests**: 例外シナリオの網羅テスト

テスト実行コマンド：

```bash
deno test --allow-all tests/unit/domain/schema/services/jmespath-filter-service_test.ts
deno test --allow-all tests/integration/schema/jmespath-filtering-integration_test.ts
```

### 4.7 CI/CD統合確認

実装後は必ずCI pipeline全体を実行し、品質基準を満たすことを確認します：

```bash
# Complete CI pipeline execution
deno task ci

# Individual validation steps
deno task test
deno task lint
deno task fmt
deno task type-check
```

## 5. 成果物定義

### 5.1 主成果物

- **機能実装**: JMESPath schema filtering完全実装
- **テストスイート**: 35+テストケース（unit/integration/error handling）
- **型定義**: JMESPathFilterError型とResult型統合
- **スキーマ拡張**: x-jmespath-filter JSON Schema extension

### 5.2 付録

- **用語集**: JMESPath, Schema Extension, Result Pattern, DDD Bounded Context
- **エラー分類**: Compilation/Execution/Validation error categories
- **実装パターン**: Smart Constructor, Total Function Conversion
- **パフォーマンス指標**: フィルタリング処理時間測定結果

## 6. Definition of Done (DoD)

- [ ] JMESPathFilterServiceが全てのJMESPath操作を型安全に実行する
- [ ] SchemaDefinitionがx-jmespath-filter拡張を完全にサポートする
- [ ] SchemaProcessingServiceがスキーマレベル・プロパティレベル両方のフィルタリングを実装する
- [ ] 35+のテストケースが全て成功し、エッジケースとエラーシナリオを網羅する
- [ ] CI pipeline（test/lint/fmt/type-check）が100%成功する
- [ ] 既存機能に対する回帰テストが全て成功する
- [ ] パフォーマンス影響が許容範囲内（+20%以下）である

## 7. 参照資料

### 7.1 必須参照資料（コード変更用）

- **全域性原則**: `docs/development/totality.ja.md`
- **[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)**

### 7.2 技術仕様資料

- **JMESPath仕様**: https://jmespath.org/specification.html
- **JSON Schema Extensions**:
  https://json-schema.org/understanding-json-schema/reference/generic.html#generic-keywords
- **@halvardm/jmespath API**: JSR package documentation
- **Result Pattern**: `src/domain/shared/types/result.ts`

### 7.3 実装参照ファイル

- **Core Service**: `src/domain/schema/services/jmespath-filter-service.ts`
- **Schema Extensions**:
  `src/domain/schema/value-objects/schema-property-types.ts`
- **Integration Points**:
  `src/domain/schema/services/schema-processing-service.ts`
- **Test Examples**:
  `tests/unit/domain/schema/services/jmespath-filter-service_test.ts`

## 8. 仮定リスト

1. **ライブラリ安定性**:
   @halvardm/jmespath@^0.17.0が仕様通りに動作し、APIが安定している
2. **スキーマ互換性**: x-jmespath-filter拡張が既存のJSON Schema
   validatorと競合しない
3. **パフォーマンス要件**:
   大規模データセット（10,000+要素）でのフィルタリング性能が実用的である
4. **エラー処理完全性**: JMESPathライブラリの全ての例外がキャッチ可能である

## 9. 変更履歴

- v1.0 初版作成 - JMESPath Schema Filtering機能の完全実装指示書
