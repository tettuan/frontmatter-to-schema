# Examples - 実用的なFrontmatter処理の実例集

このディレクトリには、frontmatter-to-schemaツールの実用的な使用例が含まれています。

## 目的

`examples/`
配下には、実際のプロジェクトで使用される実用的なMarkdownファイルが配置されています。これらのMarkdownを管理するためのインデックスや索引作成を行い、その作成プロセスが現実のユースケースに通用するかを検証することが目的です。

各ディレクトリはMarkdownの組織も用途も異なり、Schemaや出力するテンプレート形式もバラバラです。しかし、**複数のMarkdownのフロントマターから一覧を作成する**という抽象度では同じ処理を行っています。

この多様性のある要求を、単一のCLIツールで実現できることを実証するために、`examples/`
ディレクトリが存在します。

## ディレクトリ構成

```
examples/
├── 1.articles/     # ブログ記事・技術文書の管理
├── 2.climpt/       # CLIコマンドレジストリの管理
└── 3.docs/         # 仕様書・設計文書のトレーサビリティ管理
```

## 各例の特徴

### 1.articles/ - 記事管理システム

**用途**: ブログや技術文書のインデックス生成

- **Markdownの種類**: 技術記事、チュートリアル、ガイド文書
- **フロントマター構造**: タイトル、著者、日付、カテゴリ、タグ
- **出力形式**: YAML形式の記事インデックス
- **Schema特徴**: シンプルな記事メタデータ構造

**主要ファイル**:

- `articles_schema.json` - 記事コレクション用スキーマ
- `articles_template.yml` - YAML形式の出力テンプレート
- `docs/` - 実際の記事Markdownファイル群

### 2.climpt/ - コマンドレジストリ

**用途**: CLIツールのコマンド体系管理

- **Markdownの種類**: コマンド定義、プロンプト文書
- **フロントマター構造**: c1(カテゴリ)、c2(アクション)、c3(ターゲット)の階層構造
- **出力形式**: JSON形式のコマンドレジストリ
- **Schema特徴**: 階層的なコマンド分類と派生フィールド生成

**主要ファイル**:

- `registry_schema.json` - コマンドレジストリ用スキーマ
- `registry_template.json` - JSON形式の出力テンプレート
- `prompts/` - コマンド定義Markdownファイル群
- `frontmatter-to-json/` - 変換サンプル

### 3.docs/ - トレーサビリティ管理

**用途**: 要求・仕様・実装・テストの追跡管理

- **Markdownの種類**: 要求仕様書、設計文書、テスト仕様書
- **フロントマター構造**: レベル別（req/spec/impl/test）の文書管理
- **出力形式**: レベル別のJSON形式インデックス
- **Schema特徴**: トレーサビリティのための相互参照構造

**主要ファイル**:

- `index_*_schema.json` - レベル別スキーマファイル群
- `index_*_template.json` - レベル別テンプレートファイル群
- `docs/` - 仕様文書Markdownファイル群

## 共通の抽象化

これらの例は表面的には全く異なる用途とフォーマットを持ちますが、以下の点で共通しています：

1. **複数Markdownファイルからのメタデータ抽出**
2. **フロントマターの構造化データへの変換**
3. **スキーマによる検証と正規化**
4. **テンプレートベースの出力生成**
5. **インデックス・一覧の自動生成**

## 実行方法

各ディレクトリで以下のコマンドパターンで実行可能：

```bash
# 記事インデックス生成
./frontmatter-to-schema examples/1.articles/docs/**/*.md \
  --schema=examples/1.articles/articles_schema.json \
  --template=examples/1.articles/articles_template.yml

# コマンドレジストリ生成
./frontmatter-to-schema examples/2.climpt/prompts/**/*.md \
  --schema=examples/2.climpt/registry_schema.json \
  --template=examples/2.climpt/registry_template.json

# トレーサビリティインデックス生成
./frontmatter-to-schema examples/3.docs/docs/**/*.md \
  --schema=examples/3.docs/index_req_schema.json \
  --template=examples/3.docs/index_req_template.json
```

## 検証ポイント

これらの例を通じて、以下の点を検証しています：

- **汎用性**: 異なるドメインへの適用可能性
- **柔軟性**: 多様なスキーマ・テンプレート形式への対応
- **拡張性**: x-frontmatter-part、x-derived-fromなどの拡張機能
- **実用性**: 実際のプロジェクトでの使用に耐える品質

## まとめ

`examples/`
ディレクトリは、frontmatter-to-schemaツールが単一のCLIでありながら、多様な文書管理ニーズに対応できることを実証する、生きたドキュメントとして機能しています。

---

## Schema/Template 構築ガイド

初めてSchema/Templateを構築する際のガイドです。

### 必須ファイル構成

```
your-project/
├── schema.json              # 必須: フロントマター構造定義 + ディレクティブ
├── template.json            # 必須: 出力構造定義（コンテナ）
├── item_template.json       # 条件付き必須: 複数ファイル処理時のアイテムテンプレート
└── docs/
    └── *.md                 # 処理対象のMarkdownファイル群
```

### 最小構成（単一ファイル処理）

2ファイルで動作可能：

```json
// schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "template.json",
  "properties": {
    "title": { "type": "string" },
    "author": { "type": "string" }
  }
}
```

```json
// template.json
{
  "title": "{title}",
  "author": "{author}"
}
```

### 複数ファイル処理（リスト生成）

3ファイル必須：

```
schema.json          ─┬─ x-template → template.json
                      └─ x-template-items → item_template.json

template.json        ─── {@items} プレースホルダー配置
item_template.json   ─── 各アイテムの構造定義
```

#### Schema（registry_schema.json）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "template.json",
  "x-template-items": "item_template.json",
  "properties": {
    "items": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "item_schema.json" }
    }
  }
}
```

#### Container Template（template.json）

```json
{
  "version": "1.0.0",
  "items": "{@items}"
}
```

#### Item Template（item_template.json）

```json
{
  "title": "{title}",
  "author": "{author}"
}
```

### ディレクティブ早見表

| ディレクティブ       | 配置場所        | 値の型                  | 役割                       |
| -------------------- | --------------- | ----------------------- | -------------------------- |
| `x-template`         | Schema root     | `string` (ファイルパス) | コンテナテンプレート指定   |
| `x-template-items`   | Schema root     | `string` (ファイルパス) | アイテムテンプレート指定   |
| `x-frontmatter-part` | Schema property | `boolean` (true)        | フロントマター配列挿入位置 |
| `x-derived-from`     | Schema property | `string` (パス式)       | 他プロパティから値を導出   |
| `x-derived-unique`   | Schema property | `boolean`               | 導出配列の重複除去         |
| `{@items}`           | Template        | -                       | アイテム配列の挿入位置     |
| `{property}`         | Template        | -                       | 変数置換                   |

### 処理フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Markdownファイル群読込                                        │
│    docs/*.md → フロントマター抽出                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Schema検証                                                   │
│    各フロントマター → schema.json で構造検証                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. アイテム展開（x-template-items指定時）                        │
│    各フロントマター → item_template.json で変換                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. コンテナ生成                                                  │
│    template.json の {@items} → 展開済みアイテム配列で置換        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 出力                                                         │
│    JSON/YAML形式で出力                                          │
└─────────────────────────────────────────────────────────────────┘
```

### よくある誤り

| 誤り                                                  | 正しい形式                                 |
| ----------------------------------------------------- | ------------------------------------------ |
| `"x-template-items": { "path": "...", "key": "..." }` | `"x-template-items": "item_template.json"` |
| `"x-template-items": true` （Template内）             | `"{@items}"`                               |
| `x-frontmatter-part` をTemplate内に配置               | Schema内のpropertyに配置                   |
| item_template.json を省略（複数ファイル処理時）       | 必ず作成                                   |

### 動作確認コマンド

```bash
# 構文確認（verbose モードで詳細表示）
frontmatter-to-schema schema.json output.json ./docs/*.md --verbose

# CLIヘルプでディレクティブ詳細確認
frontmatter-to-schema --help-authoring
```

### 実例の参照

各ディレクトリに完全な動作例があります：

- `0.basic/` - 基本パターン
- `1.articles/` - 記事一覧生成
- `2.climpt/` - コマンドレジストリ（複数ファイル→JSON）
- `3.docs/` - トレーサビリティ管理
