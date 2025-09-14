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
