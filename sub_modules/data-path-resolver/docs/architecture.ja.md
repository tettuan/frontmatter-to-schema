# data-path-resolver アーキテクチャ設計書

## 1. 概要

本ドキュメントは、data-path-resolver の内部設計と実装詳細を記述します。

---

## 2. Core API 設計

### 2.1 DataPathResolver クラス

````typescript
/**
 * Resolves path expressions in data structures with array expansion support.
 *
 * Features:
 * - Dot notation: "user.profile.name"
 * - Array index: "items[0].name"
 * - Array expansion: "items[].name" → collects from all elements
 * - Double expansion: "articles[].tags[]" → deep flattening
 * - Type-safe with Result<T, E>
 *
 * @example
 * ```typescript
 * const data = {
 *   users: [
 *     {name: "Alice", tags: ["admin", "dev"]},
 *     {name: "Bob", tags: ["user"]}
 *   ]
 * };
 *
 * const resolver = new DataPathResolver(data);
 *
 * // Single value
 * resolver.resolve("users[0].name")
 *   // => Result.ok("Alice")
 *
 * // Array expansion
 * resolver.resolve("users[].name")
 *   // => Result.ok(["Alice", "Bob"])
 *
 * // Double expansion
 * resolver.resolve("users[].tags[]")
 *   // => Result.ok(["admin", "dev", "user"])
 * ```
 */
export class DataPathResolver {
  constructor(private readonly data: unknown);

  /**
   * Resolves a path expression to its value(s).
   *
   * @param path - Path expression (e.g., "items[].name")
   * @returns Result containing the resolved value or error
   *
   * Behavior:
   * - If path contains [], returns array (even for single result)
   * - If path doesn't contain [], returns single value
   * - If path doesn't exist, returns PathNotFoundError
   * - If data structure is invalid, returns InvalidStructureError
   */
  resolve<T = unknown>(path: string): Result<T, PathError>;

  /**
   * Checks if a path exists in the data.
   *
   * @param path - Path expression to check
   * @returns true if path resolves successfully
   */
  exists(path: string): boolean;

  /**
   * Resolves a path and ensures the result is an array.
   * Useful for x-derived-from processing.
   *
   * @param path - Path expression
   * @returns Result containing an array (empty if nothing found)
   *
   * Behavior:
   * - "items[].name" → returns array
   * - "user.name" → returns [value] (wrapped in array)
   * - Non-existent path → returns [] (empty array)
   */
  resolveAsArray<T = unknown>(path: string): Result<T[], PathError>;
}
````

### 2.2 API メソッド詳細

| メソッド                  | 引数      | 返却値                   | 用途                               |
| ------------------------- | --------- | ------------------------ | ---------------------------------- |
| `constructor(data)`       | `unknown` | `DataPathResolver`       | インスタンス作成                   |
| `resolve<T>(path)`        | `string`  | `Result<T, PathError>`   | パス解決（配列展開含む）           |
| `resolveAsArray<T>(path)` | `string`  | `Result<T[], PathError>` | 配列として解決（x-derived-from用） |
| `exists(path)`            | `string`  | `boolean`                | パス存在チェック                   |

---

## 3. 内部構造

### 3.1 PathSegment Type

```typescript
/**
 * Internal representation of path segments (not exported).
 */
type PathSegment =
  | { type: "property"; value: string } // "name"
  | { type: "arrayIndex"; value: number } // "[0]"
  | { type: "arrayExpansion" } // "[]"
  | { type: "arrayExpansionWithPath"; path: PathSegment[] }; // "[].prop"
```

### 3.2 PathError Type

```typescript
/**
 * Path resolution errors.
 */
export class PathError extends Error {
  readonly code: PathErrorCode;
  readonly path: string;
  readonly context?: Record<string, unknown>;

  constructor(
    code: PathErrorCode,
    message: string,
    path: string,
    context?: Record<string, unknown>,
  );
}

export enum PathErrorCode {
  PATH_NOT_FOUND = "PATH_NOT_FOUND", // パスが存在しない
  INVALID_PATH_SYNTAX = "INVALID_PATH_SYNTAX", // パス式の構文エラー
  INVALID_STRUCTURE = "INVALID_STRUCTURE", // データ構造が不正
  ARRAY_EXPECTED = "ARRAY_EXPECTED", // 配列を期待したが違う型
  INDEX_OUT_OF_BOUNDS = "INDEX_OUT_OF_BOUNDS", // インデックスが範囲外
}
```

---

## 4. 解決アルゴリズム

### 4.1 全体フロー

```
1. Parse path → PathSegment[]
2. Validate segments
3. Resolve segments sequentially:
   a. Property access → navigate to property
   b. Array index → access specific element
   c. Array expansion → collect from all elements
      - If next segment exists → recurse for each element
      - If nested array result → flatten
4. Return Result<value, error>
```

### 4.2 パス解析 (parsePath)

**入力**: `"tools.commands[].options.input[0]"`

**処理**:

```typescript
private parsePath(path: string): Result<PathSegment[], PathError> {
  // 1. トークン化
  // "tools.commands[].options.input[0]"
  // → ["tools", "commands", "[]", "options", "input", "[0]"]

  // 2. セグメント分類
  // → [
  //   {type: "property", value: "tools"},
  //   {type: "property", value: "commands"},
  //   {type: "arrayExpansion"},
  //   {type: "property", value: "options"},
  //   {type: "property", value: "input"},
  //   {type: "arrayIndex", value: 0}
  // ]

  // 3. バリデーション
  // - 連続する [] のチェック
  // - 無効な文字のチェック
  // - 配列インデックスの妥当性
}
```

### 4.3 セグメント解決 (resolveSegments)

```typescript
private resolveSegments(
  data: unknown,
  segments: PathSegment[]
): Result<unknown, PathError> {
  let current = data;

  for (const segment of segments) {
    switch (segment.type) {
      case "property":
        // null/undefined チェック
        if (current == null) {
          return Result.error(new PathError(
            PathErrorCode.PATH_NOT_FOUND,
            `Cannot access property '${segment.value}' on null/undefined`,
            path,
            {segment, current}
          ));
        }

        // オブジェクトチェック
        if (typeof current !== "object" || Array.isArray(current)) {
          return Result.error(new PathError(
            PathErrorCode.INVALID_STRUCTURE,
            `Expected object but got ${typeof current}`,
            path,
            {segment, current}
          ));
        }

        current = current[segment.value];
        break;

      case "arrayIndex":
        // 配列チェック
        if (!Array.isArray(current)) {
          return Result.error(new PathError(
            PathErrorCode.ARRAY_EXPECTED,
            `Expected array but got ${typeof current}`,
            path,
            {segment, current}
          ));
        }

        // 範囲チェック
        if (segment.value < 0 || segment.value >= current.length) {
          return Result.error(new PathError(
            PathErrorCode.INDEX_OUT_OF_BOUNDS,
            `Index ${segment.value} out of bounds [0, ${current.length})`,
            path,
            {segment, arrayLength: current.length}
          ));
        }

        current = current[segment.value];
        break;

      case "arrayExpansion":
        // 配列チェック
        if (!Array.isArray(current)) {
          return Result.error(new PathError(
            PathErrorCode.ARRAY_EXPECTED,
            `Expected array for expansion but got ${typeof current}`,
            path,
            {segment, current}
          ));
        }

        // 残りのパスがあれば各要素に適用
        const remainingSegments = segments.slice(segments.indexOf(segment) + 1);
        return this.expandArray(current, remainingSegments);
    }
  }

  return Result.ok(current);
}
```

### 4.4 配列展開 (expandArray)

```typescript
private expandArray(
  array: unknown[],
  remainingPath: PathSegment[]
): Result<unknown[], PathError> {
  const results: unknown[] = [];

  for (const item of array) {
    if (remainingPath.length === 0) {
      // 残りのパスがない場合、要素をそのまま追加
      results.push(item);
    } else {
      // 残りのパスを各要素に適用
      const result = this.resolveSegments(item, remainingPath);

      if (result.isError()) {
        // エラーはスキップ（ルール5: 存在しない要素は無視）
        continue;
      }

      const value = result.unwrap();

      // 結果が配列なら展開、そうでなければ追加
      if (Array.isArray(value)) {
        results.push(...value); // フラット化
      } else {
        results.push(value);
      }
    }
  }

  return Result.ok(results);
}
```

**具体例**:

```typescript
// データ
{
  articles: [
    { tags: ["A", "B"] },
    { tags: ["C"] },
  ];
}

// "articles[].tags[]" の内部処理
// 1. articles[] → [{tags: ["A","B"]}, {tags: ["C"]}]
// 2. 各要素の tags[] を解決
//    - item1.tags[] → ["A", "B"]
//    - item2.tags[] → ["C"]
// 3. フラット化 → ["A", "B", "C"]
```

---

## 5. 隠蔽する複雑性

### 5.1 パス式の解析

ユーザーが書くコード:

```typescript
resolver.resolve("tools.commands[].options.input[0]");
```

内部で実行される処理（隠蔽）:

- トークン化: 文字列を意味のある単位に分割
- セグメント分類: 各トークンの種類を判定
- バリデーション: 構文エラーの検出

### 5.2 配列展開の処理

ユーザーが書くコード:

```typescript
resolver.resolve("commands[].c1");
```

内部で実行される処理（隠蔽）:

- 配列の各要素に対してパス解決を実行
- 結果の収集とフラット化
- エラーハンドリング（存在しない要素のスキップ）

### 5.3 エラーハンドリング

ユーザーが書くコード（シンプル）:

```typescript
const result = resolver.resolve("user.profile.name");
if (result.isError()) {
  console.error(result.unwrapError().message);
}
```

内部で実行される処理（隠蔽）:

- 各ステップでの詳細なエラーチェック
- エラーコンテキストの構築
- 適切なエラーコードの選択

---

## 6. Advanced API

### 6.1 resolveAsArray() の実装

```typescript
/**
 * Resolves path and ensures result is an array.
 * Main use case: x-derived-from processing.
 *
 * Behavior:
 * - "items[]" → returns array as-is
 * - "user.name" → wraps in array: [value]
 * - Non-existent → returns empty array: []
 * - Error cases → returns Result.error
 */
resolveAsArray<T = unknown>(path: string): Result<T[], PathError> {
  const result = this.resolve(path);

  // エラー時はそのまま返す
  if (result.isError()) {
    // ただし PATH_NOT_FOUND は空配列として扱う（x-derived-from の要件）
    if (result.unwrapError().code === PathErrorCode.PATH_NOT_FOUND) {
      return Result.ok([]);
    }
    return result;
  }

  const value = result.unwrap();

  // 既に配列なら返す
  if (Array.isArray(value)) {
    return Result.ok(value as T[]);
  }

  // 単一値を配列化
  if (value === null || value === undefined) {
    return Result.ok([]);
  }

  return Result.ok([value] as T[]);
}
```

### 6.2 exists() の実装

```typescript
/**
 * Checks if path exists without throwing/returning error.
 * Useful for conditional logic.
 */
exists(path: string): boolean {
  const result = this.resolve(path);
  return result.isOk();
}
```

---

## 7. Type Safety

### 7.1 ジェネリクスによる型指定

```typescript
// 基本: unknown 型
const result = resolver.resolve("user.name");
// result: Result<unknown, PathError>

// 型指定: string を期待
const result = resolver.resolve<string>("user.name");
// result: Result<string, PathError>

// 型指定: 配列
const result = resolver.resolveAsArray<string>("items[].name");
// result: Result<string[], PathError>

// 型指定: オブジェクト
interface User {
  name: string;
  age: number;
}
const result = resolver.resolve<User>("user");
// result: Result<User, PathError>
```

**注意**: ジェネリクスは型アサーションであり、実行時検証ではありません。

### 7.2 Result パターン

```typescript
// 成功時
const result = resolver.resolve("user.name");
if (result.isOk()) {
  const value = result.unwrap(); // 型: unknown（または指定したT）
}

// 失敗時
if (result.isError()) {
  const error = result.unwrapError();
  console.error(error.code, error.path, error.message);
}

// パターンマッチ風
result.match({
  ok: (value) => console.log("Found:", value),
  error: (err) => console.error("Error:", err.message),
});
```

---

## 8. パフォーマンス考慮

### 8.1 メモ化（将来の最適化）

```typescript
export class DataPathResolver {
  private cache = new Map<string, Result<unknown, PathError>>();

  resolve<T = unknown>(path: string): Result<T, PathError> {
    // キャッシュチェック
    if (this.cache.has(path)) {
      return this.cache.get(path) as Result<T, PathError>;
    }

    // 解決
    const result = this.resolveInternal<T>(path);

    // キャッシュ保存
    this.cache.set(path, result as Result<unknown, PathError>);

    return result;
  }
}
```

**トレードオフ**:

- ✅ 同じパスの繰り返し解決が高速化
- ❌ メモリ使用量増加
- ❌ データ更新時にキャッシュクリアが必要

**推奨**: 初期実装ではメモ化なし（YAGNI原則）

### 8.2 最適化ポイント

1. **パス解析のキャッシュ**: 同じパス式の解析結果を再利用
2. **浅いコピーの回避**: 不要なデータコピーを最小化
3. **早期リターン**: エラー検出時に即座に返す

---

## 9. 実装例

### 9.1 例1: x-derived-from での使用

**現在の実装（複雑）**:

```typescript
// schema-directive-processor.ts:283-329 (50行)
private extractValuesFromPath(data: Record<string, unknown>, path: string): string[] {
  const values: string[] = [];
  const nestedMatch = path.match(/^(.+?)\[\]\.(.+)$/);
  // ... 複雑なロジック
  return values;
}
```

**data-path-resolver 使用後（シンプル）**:

```typescript
import { DataPathResolver } from "../../../sub_modules/data-path-resolver/mod.ts";

private extractValuesFromPath(
  data: Record<string, unknown>,
  path: string
): Result<string[], ProcessingError> {
  const resolver = new DataPathResolver(data);

  // resolveAsArray は常に配列を返す
  const result = resolver.resolveAsArray<unknown>(path);

  if (result.isError()) {
    return Result.error(new ProcessingError(
      `Failed to resolve path '${path}': ${result.unwrapError().message}`,
      "PATH_RESOLUTION_ERROR",
      {path, error: result.unwrapError()}
    ));
  }

  // 文字列化（x-derived-from の要件）
  const values = result.unwrap().map(v => String(v));
  return Result.ok(values);
}
```

**削減**: 50行 → 15行

---

### 9.2 例2: テンプレート変数解決

**現在の実装（重複）**:

```typescript
// template-renderer.ts:196-217 (20行)
private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  // ... 複雑なロジック
  return current;
}
```

**data-path-resolver 使用後（統合）**:

```typescript
import { DataPathResolver } from "../../../sub_modules/data-path-resolver/mod.ts";

export class TemplateVariableResolver {
  private resolver: DataPathResolver;

  constructor(data: Record<string, unknown>) {
    this.resolver = new DataPathResolver(data);
  }

  resolve(path: string): Result<unknown, TemplateError> {
    const result = this.resolver.resolve(path);

    if (result.isError()) {
      return Result.error(
        new TemplateError(
          `Variable not found: ${path}`,
          "VARIABLE_NOT_FOUND",
          { path, cause: result.unwrapError() },
        ),
      );
    }

    return Result.ok(result.unwrap());
  }
}
```

**統合**: 3箇所の実装が1つに

---

### 9.3 例3: Issue #1217 解決

**問題**: `articles[].topics` が配列の配列を返す

```typescript
// データ
{
  articles: [
    { topics: ["AI", "Cursor"] },
    { topics: ["Claude"] },
  ];
}

// 現在の実装
const values = extractValuesFromPath(data, "articles[].topics");
// => [["AI", "Cursor"], ["Claude"]]  ❌ フラット化されない

// data-path-resolver 使用
const resolver = new DataPathResolver(data);
const result = resolver.resolve("articles[].topics[]");
//                                                 ^^^ 二重展開
// => Result.ok(["AI", "Cursor", "Claude"])  ✅ 自動フラット化
```

---

## 10. ディレクトリ構造

```
sub_modules/data-path-resolver/
├── docs/
│   ├── requirements.ja.md    # 要件定義（本文書の姉妹ドキュメント）
│   ├── architecture.ja.md    # アーキテクチャ設計（本文書）
│   └── API.md                # API リファレンス（英語）
├── src/
│   ├── mod.ts                # エクスポート
│   ├── data-path-resolver.ts # メインクラス
│   ├── path-parser.ts        # パス解析ロジック
│   ├── path-error.ts         # エラー定義
│   └── types.ts              # 型定義
├── tests/
│   ├── data-path-resolver_test.ts
│   ├── path-parser_test.ts
│   ├── array-expansion_test.ts
│   └── error-handling_test.ts
├── examples/
│   ├── basic-usage.ts
│   ├── array-expansion.ts
│   ├── error-handling.ts
│   └── type-safety.ts
├── deno.json                 # Deno configuration
├── deno.lock                 # Lock file
├── README.md                 # Quick Start
└── CLAUDE.md                 # AI agent instructions
```

---

## 11. Migration Path

### Phase 1: 基本実装 + schema-directive-processor 統合

1. DataPathResolver の実装
2. extractValuesFromPath の置換
3. 既存テストの通過確認

### Phase 2: json-template 統合

1. VariableResolver の書き換え
2. json-template のテスト更新
3. 統合テストの実行

### Phase 3: template-renderer 統合

1. getNestedValue の置換
2. template-renderer のテスト更新
3. E2Eテストの実行

---

## 12. まとめ

data-path-resolver は、パス解決ロジックを一元化し、以下を実現します：

- **重複コードの削減**: 3箇所 → 1箇所
- **保守性の向上**: 50行 → 15行
- **機能の拡張**: 二重展開構文のサポート
- **型安全性**: Result<T, E> パターン
- **独立性**: 単独でテスト可能

これにより、Issue #1217 の解決と、コードベース全体の品質向上を実現します。
