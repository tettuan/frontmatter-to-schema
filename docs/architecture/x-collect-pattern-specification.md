# x-collect-pattern ディレクティブ設計書

## 概要

Schema定義でワイルドカードパターンを指定し、パターンにマッチするプロパティを収集してテンプレートで利用可能にする機能。

## 設計決定事項

### 1. ディレクティブ名

**選択: `x-collect-pattern`**

| 候補 | Pros | Cons |
|------|------|------|
| `x-collect-pattern` | 動作が明確（パターンを収集）、既存の`x-derived-*`と区別しやすい | 新規命名 |
| `x-pattern-properties` | JSON Schema標準に近い名称 | JSON Schemaの`patternProperties`と混同しやすい |
| `x-dynamic-properties` | 動的性を表現 | 曖昧、何を動的にするか不明確 |

**決定理由**: 「パターンにマッチするプロパティを収集する」という動作を直接的に表現する名称。既存の`x-derived-from`（他から派生）と類似の命名規則で一貫性がある。

---

### 2. 処理フェーズ

**選択: フロントマター抽出フェーズ（yaml-schema-mapper処理時）**

| フェーズ | Pros | Cons |
|----------|------|------|
| yaml-schema-mapper処理時 | フロントマター項目（options, input_file等）と同タイミング、テンプレートマッピングに必要な項目定義として適切 | yaml-schema-mapperへの機能追加が必要 |
| Phase 1（個別ファイル処理） | 既存フレームワーク内で実装 | フロントマター抽出後になり、項目定義としての役割に遅い |
| Phase 2（全体統合） | 統合後データも対象 | フロントマター項目との一貫性がない、テンプレートマッピングに間に合わない |

**決定理由**:
- `options`, `input_file`, `stdin`などのフロントマター項目と同じタイミングで処理
- フロントマターのParseとテンプレートへのマッピングに必要な項目定義
- 各マークダウンファイルのフロントマター処理時点で収集を完了
- DATA_EXTRACTIONカテゴリに属する

---

### 3. 出力形式

**選択: 配列形式（key-value objects）**

```json
// 出力形式（アイテムデータの一部として格納）
{
  "options": {
    "input": ["default"],
    "destination": true
  },
  "user_variables": [
    { "key": "uv-scope", "value": "domain architecture" },
    { "key": "uv-date", "value": "2025-06-08" }
  ]
}
```

| 形式 | Pros | Cons |
|------|------|------|
| key-value配列 | 各要素がオブジェクトなので構造が明確、json-templateの配列インデックス参照可能 | オブジェクトより冗長 |
| オブジェクト | コンパクト | 動的キー名へのアクセス手段がない、順序不定 |
| 値のみの配列 | シンプル | キー情報が失われる |

**決定理由**:
- 収集結果はアイテムデータの一部として格納される
- アイテムテンプレートから `{user_variables}` で配列全体を参照
- `{user_variables[0].key}`, `{user_variables[0].value}` で個別要素にアクセス可能
- 配列としてそのままJSON出力に含められる

**`{@items}`との関係**:
- `{@items}` は `x-frontmatter-part: true` の配列を展開する専用記法
- `x-collect-pattern` の結果は `{@items}` とは別の仕組み
- 収集結果は通常のプロパティとしてアイテムデータに含まれ、アイテムテンプレートから参照される

---

### 4. パターン記法

**選択: 正規表現（ECMAScript RegExp）**

| 記法 | Pros | Cons |
|------|------|------|
| 正規表現 | 表現力が高い、JSON Schema標準と同じ、精密なマッチング | 学習コスト、エスケープが必要 |
| glob | シンプル、直感的 | 表現力が限定的、標準化が曖昧 |
| 文字列前方一致 | 非常にシンプル | 柔軟性がない |

**決定理由**:
- JSON Schema の `patternProperties` と同じ記法で互換性
- `^uv-.*$`, `^config_.*$` など複雑なパターンに対応
- バリデーション時に正規表現の妥当性をチェック可能

---

### 5. ソース指定方法

**選択: パス指定方式**

```json
{
  "x-collect-pattern": {
    "source": "options",
    "pattern": "^uv-.*$"
  }
}
```

| 方式 | Pros | Cons |
|------|------|------|
| パス指定 | 任意の階層から収集可能、`x-derived-from`と一貫性 | 記述が少し冗長 |
| 同一階層限定 | 記述がシンプル | 柔軟性がない、ネストしたオブジェクトに適用不可 |

**決定理由**:
- `options.advanced`のようなネストしたオブジェクトからも収集可能
- `x-derived-from`と同じパス記法で一貫性

---

### 6. additionalProperties との関係

**選択: 暗黙的に true を要求（エラー時は警告）**

| 方式 | Pros | Cons |
|------|------|------|
| 暗黙的true要求 | 設定忘れを防止、明確なエラーメッセージ | 既存スキーマの修正が必要 |
| 独立動作 | 既存スキーマ変更不要 | `additionalProperties: false`との矛盾が発生 |

**決定理由**:
- `additionalProperties: false`の場合、yaml-schema-mapperがプロパティをドロップするため、収集対象がなくなる
- 矛盾した設定を検出し、明確な警告を出力
- 将来的に`patternProperties`サポート追加時の移行パスを確保

---

### 7. テンプレートでのアクセス方法

**選択: 通常の変数参照**

```json
{
  "user_variables": "{user_variables}"
}
```

| 方式 | Pros | Cons |
|------|------|------|
| 通常変数参照 | 既存テンプレート記法そのまま、学習コストなし | - |
| 特殊記法 | 動的収集を明示 | 新しい記法の学習コスト、実装複雑 |

**決定理由**:
- `x-collect-pattern`の結果はSchemaで定義されたプロパティに格納される
- テンプレート側は結果を通常の変数として参照するだけ
- 関心の分離（収集ロジックはSchema、出力形式はテンプレート）

---

## 完全なSchema定義仕様

### 基本構文

```json
{
  "collected_property_name": {
    "type": "array",
    "x-collect-pattern": {
      "source": "path.to.object",
      "pattern": "^regex-pattern$"
    },
    "items": {
      "type": "object",
      "properties": {
        "key": { "type": "string" },
        "value": { "type": "string" }
      }
    }
  }
}
```

### 重要: プロパティ名はSchemaで決定

`x-collect-pattern`の結果を格納するプロパティ名は**Schema作成者が自由に決定**する。実装側でのハードコードはない。

```json
// 例1: user_variables という名前
{
  "user_variables": {
    "x-collect-pattern": { "source": "options", "pattern": "^uv-.*$" }
  }
}

// 例2: custom_params という名前
{
  "custom_params": {
    "x-collect-pattern": { "source": "config", "pattern": "^param_.*$" }
  }
}

// 例3: env_settings という名前
{
  "env_settings": {
    "x-collect-pattern": { "source": "environment", "pattern": "^ENV_.*$" }
  }
}
```

これは既存の `x-derived-from` と同じパターン：

| ディレクティブ | プロパティ名 | ディレクティブの役割 |
|---------------|-------------|---------------------|
| `x-derived-from` | Schema作成者が決定 | 派生元パスを指定 |
| `x-collect-pattern` | Schema作成者が決定 | 収集元と正規表現パターンを指定 |

### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `source` | string | Yes | 収集対象オブジェクトへのパス（ドット記法） |
| `pattern` | string | Yes | 正規表現パターン（ECMAScript） |
| `format` | string | No | 出力形式（デフォルト: `"key-value"`） |

### format オプション（将来拡張）

- `"key-value"`: `[{key, value}, ...]`（デフォルト）
- `"object"`: `{key1: value1, key2: value2, ...}`
- `"keys"`: `["key1", "key2", ...]`
- `"values"`: `[value1, value2, ...]`

---

## 処理フロー

```
1. yaml-schema-mapper処理
   - additionalProperties: true により未定義プロパティを保持
   - x-collect-pattern によるパターンマッチング収集
   - 収集結果をSchema定義プロパティに格納
   ↓
2. Phase 1処理（個別ファイル）
   - x-flatten-arrays, x-jmespath-filter
   ↓
3. Phase 2処理（全体統合）
   - x-derived-from
   - x-derived-unique
   ↓
4. Phase 3処理（テンプレート展開）
   - 収集結果を通常変数として参照
```

### 処理タイミングの詳細

`x-collect-pattern`は`yaml-schema-mapper`の`mapObject()`処理内で実行される：

1. 通常のプロパティマッピング（exact, x-map-from, case-insensitive, heuristic）
2. **パターンマッチング収集**（x-collect-pattern）
3. additionalPropertiesの処理

これにより、`options`や`input_file`などの固定プロパティと同じタイミングで、動的プロパティも収集される。

---

## 実装影響範囲

### 変更が必要なファイル

#### 1. `sub_modules/yaml-schema-mapper/src/yaml-mapper.ts`（主要変更）

```typescript
// mapObject() 内に追加
function mapObject(...) {
  // 1. 通常のプロパティマッピング
  for (const [schemaKey, schemaProperty] of Object.entries(schemaProperties)) {
    // existing mapping logic...
  }

  // 2. x-collect-pattern 処理を追加
  for (const [schemaKey, schemaProperty] of Object.entries(schemaProperties)) {
    if (schemaProperty["x-collect-pattern"]) {
      const collectResult = applyCollectPattern(
        data,
        schemaProperty["x-collect-pattern"],
        schemaKey
      );
      result[schemaKey] = collectResult;
    }
  }

  // 3. additionalProperties 処理
  // existing logic...
}
```

#### 2. `sub_modules/yaml-schema-mapper/src/types.ts`

```typescript
// SchemaProperty に x-collect-pattern を追加
export interface SchemaProperty {
  // ... existing
  "x-collect-pattern"?: {
    source: string;
    pattern: string;
    format?: "key-value" | "object" | "keys" | "values";
  };
}
```

#### 3. 新規作成: `sub_modules/yaml-schema-mapper/src/pattern-collector.ts`

```typescript
export interface CollectPatternConfig {
  source: string;
  pattern: string;
  format?: "key-value" | "object" | "keys" | "values";
}

export function collectByPattern(
  data: Record<string, unknown>,
  config: CollectPatternConfig
): unknown[] | Record<string, unknown> {
  // パターンマッチング実装
}
```

#### 4. `src/domain/schema/constants/directive-names.ts`

```typescript
export const DIRECTIVE_NAMES = {
  // ... existing
  COLLECT_PATTERN: "x-collect-pattern",
} as const;

export const DIRECTIVE_CATEGORIES = {
  DATA_EXTRACTION: [
    DIRECTIVE_NAMES.FRONTMATTER_PART,
    DIRECTIVE_NAMES.COLLECT_PATTERN,
  ],
  // ...
} as const;
```

### 変更不要なファイル

- `src/domain/schema/services/schema-directive-processor.ts` - yaml-schema-mapperで処理済み
- `sub_modules/json-template/` - 通常変数参照で対応
- `src/domain/template/` - 変更不要

### サブモジュール変更の注意点

`sub_modules/yaml-schema-mapper/`を変更するため、以下のブランチ戦略に従う：

```
sub_module/yaml-schema-mapper/feature/collect-pattern
```

サブモジュールは完全独立のため、親プロジェクトへの依存は禁止。

---

## 使用例

### Schema定義

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "options": {
      "type": "object",
      "properties": {
        "input": { "type": "array" },
        "destination": { "type": "boolean" }
      },
      "additionalProperties": true
    },
    "user_variables": {
      "type": "array",
      "description": "Collected user variables matching uv-* pattern",
      "x-collect-pattern": {
        "source": "options",
        "pattern": "^uv-.*$"
      },
      "items": {
        "type": "object",
        "properties": {
          "key": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    }
  }
}
```

### 入力フロントマター

```yaml
---
options:
  input: ["default"]
  destination: true
  uv-scope: "domain architecture"
  uv-date: "2025-06-08"
  uv-author: "John"
---
```

### 処理結果

```json
{
  "options": {
    "input": ["default"],
    "destination": true,
    "uv-scope": "domain architecture",
    "uv-date": "2025-06-08",
    "uv-author": "John"
  },
  "user_variables": [
    { "key": "uv-author", "value": "John" },
    { "key": "uv-date", "value": "2025-06-08" },
    { "key": "uv-scope", "value": "domain architecture" }
  ]
}
```

### アイテムテンプレート（registry_command_template.json）

```json
{
  "c1": "{c1}",
  "c2": "{c2}",
  "c3": "{c3}",
  "options": {
    "input": "{options.input}",
    "destination": "{options.destination}"
  },
  "user_variables": "{user_variables}"
}
```

**説明**:
- `{user_variables}` で収集された配列全体を参照
- 配列はそのままJSON出力に含まれる
- `{@items}` は使用しない（`x-frontmatter-part`用の記法）

### 最終出力例

```json
{
  "c1": "refactor",
  "c2": "basedon",
  "c3": "ddd",
  "options": {
    "input": ["default"],
    "destination": true
  },
  "user_variables": [
    { "key": "uv-author", "value": "John" },
    { "key": "uv-date", "value": "2025-06-08" },
    { "key": "uv-scope", "value": "domain architecture" }
  ]
}
```

---

## 矛盾点セルフチェック

### チェック項目

1. **処理タイミングの整合性**
   - ✅ フロントマター抽出（yaml-schema-mapper）と同タイミング
   - ✅ `options`, `input_file`, `stdin`などの固定項目と同時に処理
   - ✅ テンプレートマッピングに必要な項目定義として適切

2. **additionalProperties との整合性**
   - ✅ `additionalProperties: true` が必要であることを明記
   - ⚠️ `additionalProperties: false` との矛盾を警告で検出
   - ✅ yaml-schema-mapper内で一貫した処理

3. **パス解決の一貫性**
   - ✅ ドット記法でソースオブジェクトを指定
   - ✅ yaml-schema-mapper内で自己完結（親プロジェクト依存なし）

4. **テンプレートとの統合**
   - ✅ 通常変数として参照、特殊記法不要
   - ✅ `{@items}`による配列展開が可能
   - ✅ フロントマター抽出完了時点で収集済み

5. **サブモジュール独立性**
   - ✅ yaml-schema-mapperは親プロジェクトに依存しない
   - ✅ 独自の型定義とエラーハンドリング
   - ✅ ブランチ戦略に従う

6. **エラーハンドリング**
   - ✅ 無効な正規表現は処理時にエラー
   - ✅ 存在しないソースパスはエラー
   - ✅ `MappingWarning`で警告を報告

### 潜在的な問題と対策

| 問題 | 対策 |
|------|------|
| 大量のプロパティがマッチした場合のパフォーマンス | 警告を出力、制限オプションを将来追加 |
| 正規表現のReDoS攻撃 | パターンの複雑さチェック、タイムアウト設定 |
| ネストしたオブジェクト内のプロパティ | 現バージョンでは直接の子プロパティのみ対象（明確化） |

---

## テスト計画

### ユニットテスト

1. `CollectPatternDirective.create()` - バリデーション
2. パターンマッチング - 各種正規表現
3. 出力形式 - key-value配列生成

### 統合テスト

1. Schema → yaml-schema-mapper → directive処理 → テンプレート
2. 複数パターン収集
3. `x-derived-unique`との組み合わせ

### E2Eテスト

1. `examples/` に実例を追加
2. CLI経由での実行確認

---

## 実装優先度

1. **Phase 1**: 基本機能
   - `CollectPatternDirective` Value Object
   - `SchemaDirectiveProcessor` への統合
   - 基本テスト

2. **Phase 2**: テスト・ドキュメント
   - 統合テスト
   - ドキュメント更新
   - examples追加

3. **Phase 3**: 拡張機能（将来）
   - `format`オプション
   - ネストしたオブジェクト対応
   - パフォーマンス最適化
