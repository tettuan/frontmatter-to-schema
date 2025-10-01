# data-path-resolver 要件定義書

## 1. 概要

### 1.1 目的

data-path-resolver は、JSON互換データ構造に対するパス式解決を提供するサブモジュールです。配列展開構文（`items[]`）をサポートし、ネストされたデータ構造からの効率的なデータ抽出を可能にします。

### 1.2 背景

frontmatter-to-schema プロジェクトにおいて、パス解決ロジックが3箇所に重複実装されています：

1. `schema-directive-processor.ts` - `extractValuesFromPath()` + `getNestedValue()`
2. `template-renderer.ts` - `getNestedValue()`
3. `json-template/variable-resolver.ts` - `resolve()` + `parsePath()`

これらを統合し、独立してテスト可能な単一のライブラリとして提供することで、コードの重複を排除し、保守性を向上させます。

### 1.3 解決する問題

- **Issue #1217**: YAML配列レンダリング時の配列のフラット化不足
- **コード重複**: 3箇所の類似実装による保守コスト増大
- **記法の不統一**: パス解決ロジックが分散しているための一貫性の欠如

---

## 2. 設計原則

### 2.1 責務の明確化

| 項目 | 説明 |
|------|------|
| **入力** | データ構造（JSON互換） + パス式（文字列） |
| **隠蔽** | パス解析、配列展開、ネスト解決の複雑なロジック |
| **出力** | `Result<T, E>` による型安全な結果 |

### 2.2 Totality原則の遵守

すべての操作は `Result<T, Error>` パターンを使用し、例外を投げない設計とします。

### 2.3 独立性

他のドメインロジックに依存せず、汎用的なパス解決機能を提供します。

---

## 3. 機能要件

### 3.1 パス式構文のサポート

#### 必須サポート記法

| 記法 | 例 | 説明 | 返却型 |
|------|-----|------|--------|
| **ドット記法** | `user.profile.name` | ネストされたプロパティアクセス | 単一値 |
| **配列インデックス** | `items[0]` | 特定インデックスの要素 | 単一値 |
| **配列展開** | `items[]` | 配列の全要素を収集 | 配列 |
| **プロパティ付き展開** | `items[].name` | 各要素のプロパティを収集 | 配列 |
| **二重展開** | `items[].tags[]` | ネスト配列をフラット化 | 配列 |
| **複合パス** | `tools.commands[].options.input[0]` | 複雑な組み合わせ | 値（型による） |

#### 展開動作ルール

```typescript
// ルール1: [] は配列を期待する
"items[]"         // items が配列でなければエラー

// ルール2: [] は自動的に結果を配列化
"items[].name"    // 常に配列を返す（要素が1個でも [value]）

// ルール3: 二重 [] は深いフラット化
"items[].tags[]"  // [[A,B], [C]] → [A,B,C]

// ルール4: [] なしは単一値
"items[0].name"   // 配列ではなく単一値

// ルール5: 存在しない要素は無視
"items[].name"    // name がない要素はスキップ（エラーにしない）
```

### 3.2 データ型のサポート

- JSON互換型: `object`, `array`, `string`, `number`, `boolean`, `null`
- `undefined` の扱い: 存在しないプロパティとして扱う
- `function` の扱い: サポート対象外（エラー）

### 3.3 API要件

#### 必須メソッド

```typescript
export class DataPathResolver {
  constructor(data: unknown);

  /**
   * パス式を解決して値を返す
   * @param path - パス式（例: "items[].name"）
   * @returns Result<T, PathError>
   */
  resolve<T = unknown>(path: string): Result<T, PathError>;

  /**
   * パスを解決し、結果を必ず配列として返す
   * x-derived-from ディレクティブ処理用
   * @param path - パス式
   * @returns Result<T[], PathError>
   */
  resolveAsArray<T = unknown>(path: string): Result<T[], PathError>;

  /**
   * パスが存在するかチェック
   * @param path - パス式
   * @returns boolean
   */
  exists(path: string): boolean;
}
```

---

## 4. 非機能要件

### 4.1 パフォーマンス

- **スループット**: 1,000回/秒以上のパス解決
- **レイテンシ**: 単純パス（3階層以下）は 1ms 以内
- **メモリ**: 初期実装ではキャッシュなし（YAGNI原則）

### 4.2 テストカバレッジ

- **最低ライン**: 90% 以上
- **目標**: 95% 以上
- **テスト数**: 50+ のユニットテスト

### 4.3 型安全性

- TypeScript strict mode 準拠
- ジェネリクスによる型推論サポート
- `Result<T, E>` パターンによる明示的エラーハンドリング

### 4.4 保守性

- 既存実装（50行）を15行程度に削減
- コメント率: 重要ロジックには JSDoc
- コード行数: 500行以内

---

## 5. ユースケース

### 5.1 x-derived-from ディレクティブ処理

**現状の課題**:
```typescript
// schema-directive-processor.ts:283-329 (50行)
private extractValuesFromPath(data: Record<string, unknown>, path: string): string[] {
  const values: string[] = [];
  const nestedMatch = path.match(/^(.+?)\[\]\.(.+)$/);
  // ... 複雑な実装
  return values;
}
```

**要求**:
- `commands[].c1` のようなパス式から配列を抽出
- 結果を必ず配列として返す（単一値も `[value]` に変換）
- 文字列化が必要（`String(value)`）

**期待動作**:
```typescript
const resolver = new DataPathResolver(data);
const result = resolver.resolveAsArray<unknown>("commands[].c1");
// 常に Result<unknown[], PathError> を返す
```

---

### 5.2 テンプレート変数解決

**現状の課題**:
```typescript
// template-renderer.ts:196-217 (20行)
private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  // ... 複雑な実装
  return current;
}
```

**要求**:
- `user.profile.name` のようなドット記法をサポート
- 配列インデックス `items[0]` をサポート
- 配列展開 `items[].name` をサポート

**期待動作**:
```typescript
const resolver = new DataPathResolver(templateData);
const result = resolver.resolve("user.profile.name");
if (result.isOk()) {
  const value = result.unwrap();
  // テンプレートに埋め込む
}
```

---

### 5.3 配列のフラット化（Issue #1217 解決）

**現状の課題**:
```yaml
# データ
articles:
  - topics: ["AI", "Cursor"]
  - topics: ["Claude"]

# 現在の結果（フラット化されない）
derived_topics:
  - - "AI"
    - "Cursor"
  - - "Claude"
```

**要求**:
- `articles[].topics[]` のような二重展開構文
- 自動的にネスト配列をフラット化
- YAML出力で正しい配列形式

**期待動作**:
```typescript
const resolver = new DataPathResolver(data);
const result = resolver.resolve("articles[].topics[]");
// Result.ok(["AI", "Cursor", "Claude"]) ✅ フラット化
```

---

## 6. エラーハンドリング要件

### 6.1 エラー分類

| エラーコード | 発生条件 | 推奨対応 |
|-------------|---------|---------|
| `PATH_NOT_FOUND` | パスが存在しない | デフォルト値を使用 |
| `INVALID_PATH_SYNTAX` | パス式の構文エラー | バリデーションエラーとして報告 |
| `INVALID_STRUCTURE` | データ構造が不正 | データ検証エラーとして報告 |
| `ARRAY_EXPECTED` | 配列を期待したが違う型 | スキーマ定義エラーとして報告 |
| `INDEX_OUT_OF_BOUNDS` | インデックスが範囲外 | `PATH_NOT_FOUND` として扱う |

### 6.2 PathError 構造

```typescript
class PathError extends Error {
  readonly code: PathErrorCode;
  readonly path: string;
  readonly context?: Record<string, unknown>;
}
```

### 6.3 エラーハンドリングの一貫性

- すべてのメソッドは `Result<T, PathError>` を返す（exists除く）
- 例外を投げない（Totality原則）
- エラーメッセージは英語で記述
- コンテキスト情報を含める（デバッグ用）

---

## 7. テスト要求

### 7.1 ユニットテスト（50+ テスト）

#### Path Parsing (10+ tests)
- 単純なプロパティパス
- 配列インデックスパス
- 配列展開パス
- 二重展開パス
- 複合パス
- 無効なパス（構文エラー）

#### Resolution (20+ tests)
- ネストされたプロパティ解決
- 配列要素解決
- 配列展開解決
- 二重展開解決
- 複合パス解決

#### Error Cases (10+ tests)
- 存在しないパス
- 無効な配列インデックス
- 型の不一致
- null/undefined の扱い

#### Edge Cases (10+ tests)
- 空配列
- 空オブジェクト
- 深いネスト（10階層以上）
- 特殊文字を含むプロパティ名

### 7.2 統合テスト

```typescript
// Real-world scenarios
Deno.test("x-derived-from: commands[].c1", ...);
Deno.test("YAML rendering: articles[].tags[]", ...);
Deno.test("Template variables: user.profile.name", ...);
```

### 7.3 パフォーマンステスト

- 1,000回のパス解決を1秒以内に完了
- 深いネスト（10階層）でも性能劣化なし

---

## 8. 成功基準

### 8.1 機能要件

- ✅ すべてのパス記法をサポート
- ✅ `Result<T, E>` によるエラーハンドリング
- ✅ 配列展開・二重展開の動作
- ✅ 既存3箇所の実装を置換可能

### 8.2 非機能要件

- ✅ テストカバレッジ ≥ 90%
- ✅ 型安全性（strict mode）
- ✅ パフォーマンス: 1,000回/秒以上
- ✅ ドキュメント完備（README, API docs）

### 8.3 Issue解決

- ✅ Issue #1217 (YAML配列レンダリング) 解決
- ✅ 3箇所の重複コード削減
- ✅ パス解決ロジックの一元化

---

## 9. 制約事項

### 9.1 サポート対象外

- 正規表現パターンマッチング
- XPath/JSONPath のような高度なクエリ
- データの更新・変更（読み取り専用）
- 循環参照の検出

### 9.2 想定環境

- Deno runtime
- TypeScript 5.0+
- ES2019+ features

---

## 10. Migration Strategy

### Phase 1: 基本実装 + schema-directive-processor 統合
- DataPathResolver の実装
- extractValuesFromPath の置換

### Phase 2: json-template 統合
- VariableResolver の書き換え

### Phase 3: template-renderer 統合
- getNestedValue の置換

各フェーズで既存テストが通ることを確認します。

---

## 11. Documentation Requirements

### 11.1 必須ドキュメント

- **README.md**: Quick Start, Installation, Basic Usage
- **requirements.ja.md**: 本ドキュメント
- **architecture.ja.md**: 内部設計・実装詳細
- **API.md**: 完全なAPI仕様（英語）

### 11.2 Example Code

```typescript
// examples/basic-usage.ts
// examples/array-expansion.ts
// examples/error-handling.ts
// examples/type-safety.ts
```

---

## 12. 参考資料

- **Issue #1217**: YAML配列レンダリング問題
- **tmp/array-expansion-deep-dive-analysis.md**: 配列展開記法の詳細分析
- **tmp/submodule-strategy-reevaluation.md**: サブモジュール化判断基準
