# Issue: Test Data Hardcoding Violates Prohibit-Hardcoding Rules

## 問題の詳細

### 違反箇所
テストファイルに具体的なコマンド名がハードコードされている：

1. **registry-builder-adapter.test.ts** (34-88行目)
   ```typescript
   c1: "climpt-build"  // ハードコード
   c1: "climpt-design" // ハードコード
   c1: "climpt-spec"   // ハードコード
   ```

2. **command-processor-adapter.test.ts** (63-470行目)
   同様のハードコーディングパターン

### 規定違反
`docs/development/prohibit-hardcoding.ja.md` 第3条に違反：
> 意味を持たない数値（マジックナンバー）を直接記述すること
> 設定ファイル・環境変数で管理すべき値をソースコードに記述すること

## 改善案

### 即座の対応
テストフィクスチャファイルの作成：

```typescript
// tests/fixtures/command-categories.ts
export const MOCK_COMMAND_CATEGORIES = {
  PRIMARY: "test-category-primary",
  SECONDARY: "test-category-secondary",
  TERTIARY: "test-category-tertiary"
} as const;

export function createMockCommand(category: string): Command {
  return {
    c1: category,
    c2: "test-layer",
    c3: "test-directive",
    // ...
  };
}
```

### 長期的な改善
1. テストデータファクトリーパターンの導入
2. 環境変数によるテストカテゴリーのカスタマイズ
3. データドリブンテストの実装

## 影響範囲
- 15+ テストケース
- 2つの主要なアダプターテスト

## 優先度
**中** - 機能には影響しないが、コード品質とメンテナンス性に影響

## 関連Issue
- #dynamic-climpt-discovery: 動的コマンド発見の実装