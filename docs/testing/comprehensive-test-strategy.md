---
title: "DDD包括的テスト戦略：型安全性と品質保証の完全実装ガイド"
version: "1.0"
created: "2025-01-19"
variables:
  - input_text: テスト対象となるDDDコンポーネント領域
  - destination_path: テスト実装の出力先ディレクトリ
  - uv-test-scope: テストスコープのプレフィックス指定
---

# DDD包括的テスト戦略：型安全性と品質保証の完全実装ガイド

## 0. 目的・適用範囲

**目的**: Domain-Driven
Design（DDD）アーキテクチャにおける包括的テスト戦略を確立し、型安全性と品質保証を実現する体系的アプローチを定める。Result型パターンと全域性原則に基づき、再現性と保守性の高いテスト実装を実現する。

**適用範囲**:

- DDDアーキテクチャのすべてのコンポーネント（値オブジェクト、エンティティ、ドメインサービス、アプリケーションサービス）
- 単体テスト、統合テスト、エンドツーエンドテストの実装と運用
- CI/CDパイプラインでの自動テスト実行と品質ゲート

**非適用範囲**:

- 外部サービスの実装テスト（モック化対象）
- 特定テストツールの操作マニュアル
- レガシーコードの部分的テスト追加

## 1. 不変条件（壊してはならない性質）

1. **全域性保証**: すべてのテストがResult型を使用し、部分関数を排除（100%準拠）
2. **再現性**: 同一環境での実行で必ず同じ結果を得る（再現差分 ≤ 1%）
3. **独立性**: テスト間の依存関係なし、任意順序実行可能（相互依存度0）
4. **網羅性**: 境界値、エッジケース、エラーパスの完全カバレッジ（90%以上）
5. **性能保証**: 単体テスト < 10ms/test、統合テスト < 500ms/test

## 2. 前提情報・仮定

### 前提情報リスト

- **プロジェクト構造**: frontmatter-to-schema（Deno TypeScript DDD実装）
- **現状**: 41テスト（186ステップ）合格、TypeScript/lint完全準拠
- **テストフレームワーク**: Deno標準テスト機能（jsr:@std/assert）
- **アーキテクチャ**: ヘキサゴナルアーキテクチャ、Result型パターン採用
- **品質原則**: totality原則、AI複雑性制御

### 仮定リスト

- Deno実行環境（--allow-read, --allow-write, --allow-env権限）利用可能
- TypeScript strict modeが有効
- 開発者がDDDパターンと全域性原則を理解済み

## 3. テスト設計原則

### 3.1 Result型パターンの適用

**実行判断**: すべてのテストでResult型による安全な処理を実装

```typescript
// ✅ 正しい実装: Result型による全域性保証
function testValueObject(input: string): TestResult {
  const result = DocumentPath.create(input);
  if (result.ok) {
    return { success: true, data: result.data, assertions: [...] };
  }
  return { success: false, error: result.error, expectedError: true };
}

// ❌ 避けるべき実装: 部分関数
function badTest(input: string) {
  const result = DocumentPath.create(input);
  return result.data; // okチェックなし - 部分関数
}
```

### 3.2 テストピラミッド戦略

**実行判断**: レイヤーごとの責務に応じたテスト実装

1. **単体テスト（70%）**: 値オブジェクト、エンティティの境界値テスト
2. **統合テスト（20%）**: ドメインサービス、リポジトリの協調動作
3. **E2Eテスト（10%）**: ユースケースのシナリオ検証

## 4. 手順

### 4.1 テスト準備フェーズ

**実行判断**: 新機能実装またはリファクタリング開始時

**完了条件**:

- テストヘルパー関数の定義完了
- モック実装の準備完了
- テストデータビルダーの構築完了

### 4.2 単体テスト実装フェーズ

**実行判断**: ドメインモデル実装完了時

#### 値オブジェクトテスト

```typescript
// tests/domain/models/value-objects.test.ts
Deno.test("DocumentPath - Smart Constructor", async (t) => {
  await t.step("正常系: 有効なパス", () => {
    const result = DocumentPath.create("/docs/test.md");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/docs/test.md");
      assertEquals(result.data.getFilename(), "test.md");
      assertEquals(result.data.getDirectory(), "/docs");
    }
  });

  await t.step("異常系: 空文字列", () => {
    const result = DocumentPath.create("");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("境界値: 空白トリミング", () => {
    const result = DocumentPath.create("  /docs/test.md  ");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/docs/test.md");
    }
  });
});
```

**品質基準**:

- 正常系、異常系、境界値の3パターン必須
- エラーの種類と内容の検証
- 不変条件の維持確認

### 4.3 統合テスト実装フェーズ

**実行判断**: ドメインサービス実装完了時

```typescript
// tests/integration/analysis-pipeline.test.ts
Deno.test("Integration: Complete Analysis Pipeline", async (t) => {
  await t.step("エンドツーエンド処理", async () => {
    const pipeline = new AnalysisPipeline(
      documentRepo,
      schemaRepo,
      templateRepo,
      analyzer,
      mapper,
    );

    const result = await pipeline.process({
      documentsPath: "./test-docs",
      schemaPath: "./schema.json",
      templatePath: "./template.yaml",
    });

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.processedCount, 3);
      assertEquals(result.data.errors.length, 0);
    }
  });
});
```

### 4.4 性能テスト実装フェーズ

**実行判断**: 機能実装完了後

```typescript
await t.step("大量データ処理性能", async () => {
  const files = generateTestFiles(100);
  const start = performance.now();

  const results = await processor.processAll(files);

  const elapsed = performance.now() - start;
  const avgTime = elapsed / files.length;

  assert(avgTime < 10, `Average time ${avgTime}ms exceeds 10ms threshold`);
});
```

### 4.5 品質検証フェーズ

**実行判断**: すべてのテスト実装完了後

**完了条件**:

- カバレッジ90%以上達成
- 全テスト合格
- CI/CDパイプライン統合完了

## 5. テストヘルパー設計

### 5.1 TestDataBuilder

```typescript
export class TestDataBuilder {
  static documentPath(path = "/test/sample.md"): DocumentPath {
    const result = DocumentPath.create(path);
    if (!result.ok) throw new Error("Test data creation failed");
    return result.data;
  }

  static frontMatter(data: Record<string, unknown>): FrontMatter {
    return FrontMatter.create(data);
  }

  static schema(definition: unknown): Schema {
    return Schema.create(definition, "1.0.0");
  }
}
```

### 5.2 ResultAssertions

```typescript
export class ResultAssertions {
  static assertSuccess<T, E>(result: Result<T, E>): T {
    if (!result.ok) {
      throw new AssertionError(
        `Expected success but got error: ${JSON.stringify(result.error)}`,
      );
    }
    return result.data;
  }

  static assertError<T, E>(result: Result<T, E>, expectedKind?: string): E {
    if (result.ok) {
      throw new AssertionError(`Expected error but got success`);
    }
    if (expectedKind && result.error.kind !== expectedKind) {
      throw new AssertionError(
        `Expected error kind ${expectedKind} but got ${result.error.kind}`,
      );
    }
    return result.error;
  }
}
```

## 6. CI/CD統合

### 6.1 自動実行設定

```bash
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - run: deno test --allow-read --allow-write --allow-env --coverage=coverage/
      - run: deno coverage coverage/ --lcov > coverage.lcov
      - uses: codecov/codecov-action@v3
```

### 6.2 品質ゲート

- テスト合格率: 100%必須
- カバレッジ: 90%以上
- 性能基準: 定義済み閾値以内
- 型チェック: エラー0

## 成果物

### 主成果物

- 包括的テストスイート実装
- テストヘルパーライブラリ
- CI/CD設定ファイル
- テスト実行ガイド

### 付録

- **用語集**: テスト用語とDDD用語の定義
- **禁止パターン**: 避けるべきテスト実装
- **前提情報リスト**: プロジェクト固有情報
- **DoD**: テスト完了定義チェックリスト

## 参照資料

### 必須参照資料

- **全域性原則**: `docs/development/totality.ja.md`
- **AI複雑化防止（科学的制御）**:
  `docs/development/ai-complexity-control_compact.ja.md`

### 一次資料

- Deno公式テストAPI仕様（正確な実装のため）
- TypeScript型システムドキュメント（型安全性確保のため）

### 二次資料

- DDDテストパターン解説（実装パターン参考のため）

## 変更履歴

- v1.0 (2025-01-19): 初版作成 - DDD包括的テスト戦略確立
