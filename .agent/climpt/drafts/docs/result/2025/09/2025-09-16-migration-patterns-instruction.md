---
title: テストヘルパー移行パターン実装指示書
description: 92+の hardcoded extension strings を TEST_EXTENSIONS 定数に移行する堅牢な手法
usage: テストファイル内のハードコード文字列を中央管理の定数に置き換え、型安全性と保守性を向上
variables:
  input_text: 移行対象となる追加要件や特別な指示
  uv-scope: 移行範囲（単一ファイル、ディレクトリ、プロジェクト全体）
---

# テストヘルパー移行パターン実装指示書

## 0. 目的・適用範囲

- **目的**: テストコード内のハードコードされたスキーマ拡張文字列を中央管理された
  TEST_EXTENSIONS 定数に置き換え、DDD および Totality
  原則に従った堅牢なテストコードベースを実現
- **適用範囲**: すべての `*_test.ts` ファイル内の `"x-"`
  プレフィックスを持つ拡張キー
- **非適用範囲**: プロダクションコード、設定ファイル、ドキュメント内の拡張キー

## 1. 不変条件

1. すべての移行は冪等性を持つ（複数回実行しても同じ結果）
2. 既存のテストがすべてパスすること（261 テスト）
3. 型チェック、リント、フォーマットがすべてパスすること
4. SchemaExtensionRegistry から取得したキーのみ使用すること
5. 移行前後で機能的な変更がないこと

## 2. 前提情報リスト

### プロジェクト情報

- **言語**: TypeScript/Deno
- **アーキテクチャ**: DDD（ドメイン駆動設計）
- **テストファイル数**: 70ファイル
- **対象拡張キー**: 9種類（x-frontmatter-part, x-template, x-template-items,
  x-derived-from, x-derived-unique, x-jmespath-filter, x-template-format,
  x-base-property, x-default-value）

### 既存インフラ

- `SchemaExtensionRegistry`: 拡張キーの中央管理クラス
- `tests/helpers/test-extensions.ts`: TEST_EXTENSIONS 定数の定義
- `tests/helpers/test-schema-builder.ts`: ビルダーパターンのヘルパー

## 3. 手順

### 3.1 事前準備

- Gitブランチ準備:
  `echo "test-extensions-migration-patterns" | climpt-git decide-branch working-branch`
  を実行し、出力結果の指示に従う

### 3.2 移行スクリプトの作成

移行の堅牢性を確保するため、自動移行スクリプトを作成：

1. **パターン認識**: ハードコードされた文字列のパターンを特定
   - `"x-extension-name"`: ダブルクォート形式
   - `'x-extension-name'`: シングルクォート形式
   - オブジェクトプロパティキーとしての使用

2. **インポート追加**: TEST_EXTENSIONS のインポートを適切な位置に追加
   - 既存インポートの確認
   - 相対パスの計算（テストファイルの深さに基づく）
   - 最後のインポート行の後に追加

3. **文字列置換**: 計算プロパティ記法への変換
   ```typescript
   // Before
   "x-template": value
   // After
   [TEST_EXTENSIONS.TEMPLATE]: value
   ```

### 3.3 型安全性の確保

1. **型推論の問題を解決**:
   - 必要に応じて `as string` キャストを追加
   - 複雑なネストオブジェクトでの型推論を明示化

2. **リント・フォーマット対応**:
   - 未使用インポートの削除
   - `const` vs `let` の適切な使用
   - Deno fmt 規則の適用

### 3.4 検証手順

1. **CI パイプラインの実行**:
   ```bash
   deno task ci
   ```
   以下のステージがすべてパスすることを確認：
   - Type Check (169 ファイル)
   - JSR Compatibility Check
   - Test Execution (261 テスト)
   - Lint Check
   - Format Check

2. **個別ファイルの型チェック**:
   ```bash
   deno check <test_file_path>
   ```

### 3.5 ESLint ルールの追加

将来のハードコーディングを防ぐため、ESLint ルールを設定：

```javascript
module.exports = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/^x-/]",
        message:
          "Use TEST_EXTENSIONS constants instead of hardcoded extension keys",
      },
    ],
  },
};
```

## 4. 成果物

### 主成果物

- 移行済みテストファイル（14ファイル、92+置換）
- 自動移行スクリプト (`scripts/migrate-test-hardcoding.ts`)
- インポート修正スクリプト (`scripts/fix-import-issues.ts`)

### 付録

- 移行完了レポート (`tmp/test-helper-migration/robust-migration-complete.md`)
- ESLint 設定の更新案

## 5. 品質基準

- **カバレッジ**: 80%以上を維持
- **テスト成功率**: 100% (261/261)
- **型エラー**: 0
- **リントエラー**: 0
- **フォーマットエラー**: 0

## 6. 参照資料

- **全域性原則**: `docs/development/totality.md`
- **AI複雑化防止**: `docs/development/ai-complexity-control_compact.ja.md`
- **DDD境界設計**: `docs/domain/boundary.md`
- **SchemaExtensionRegistry実装**:
  `src/domain/schema/value-objects/schema-extension-registry.ts`

## 7. 変更履歴

- v1.0: 初版作成 - 手動移行プロセス
- v2.0: 自動移行スクリプト追加
- v2.1: 型エラー対応とインポート修正機能追加
- v3.0: ESLint ルール追加と継続的品質保証

## 完了条件（DoD）

- [ ] すべての CI チェックがパス
- [ ] 移行対象ファイルのハードコード文字列が 0
- [ ] ESLint ルールが設定済み
- [ ] Issue #867 がクローズ済み
- [ ] 移行パターンがドキュメント化済み
