# Examples - 実用的なFrontmatter処理の実例集

このディレクトリには、frontmatter-to-schemaツールの実用的な使用例が含まれています。様々な実際のユースケースを実証しています。

## 概要

`examples/`ディレクトリには、実際のプロジェクトから取得したリアルなMarkdownファイルが含まれています。これらの例は、Markdownフロントマターからインデックスやレジストリを作成する方法を示し、多様な実世界のシナリオに対応できることを検証しています。

各ディレクトリは異なるMarkdown構造、用途、スキーマ、出力テンプレート形式を持っています。しかし、すべて**複数のMarkdownフロントマターソースからリストを作成する**という抽象的な概念を共有しています。

この多様性により、単一のCLIツールが様々な要件に対応できることを実証し、`frontmatter-to-schema`アプローチの柔軟性を証明しています。

## ディレクトリ構造

```
examples/
├── 0.basic/        # コア機能を実証する基本的な例
├── 1.articles/     # ブログ記事と技術文書の管理
├── 2.climpt/       # CLIコマンドレジストリ管理
└── 3.docs/         # 要件と仕様のトレーサビリティ管理
```

## 実行方法

各exampleディレクトリには、ツールの使用方法を示す`run.sh`スクリプトが含まれています。プロジェクトルートから実行してください：

```bash
# 基本例の実行
bash examples/0.basic/run.sh

# 記事インデックス生成の実行
bash examples/1.articles/run.sh

# コマンドレジストリ生成の実行
bash examples/2.climpt/run.sh

# トレーサビリティインデックス生成の実行
bash examples/3.docs/run.sh
```

## 成功の定義

各exampleの詳細な成功定義は、それぞれのディレクトリ内のREADMEを参照してください：

- [0.basic/README.md](0.basic/README.md) - 基本機能の成功条件
- [1.articles/README.md](1.articles/README.md) - 記事管理の成功条件
- [2.climpt/README.md](2.climpt/README.md) - コマンドレジストリの成功条件
- [3.docs/README.md](3.docs/README.md) - トレーサビリティ管理の成功条件

各READMEには以下が記載されています：

- フロントマター抽出の成功条件
- スキーマ検証の成功条件
- ディレクティブ処理（x-frontmatter-part、x-derived-from等）の成功条件
- テンプレート展開の成功条件
- 期待される出力の具体例
- 数値的な成功指標

## ユースケース

### 0. Basic - コア機能のデモンストレーション

**目的**: frontmatter-to-schemaの基本機能を実証

**ユースケース**: ツールの学習、基本機能のテスト、シンプルなコマンドレジストリ

- 基本的なスキーマ検証とテンプレート処理を表示
- 値を集約するx-derived-fromディレクティブの実証
- {@items}テンプレート展開の説明

**主な特徴**:

- **Markdownファイル**: シンプルなコマンド定義（command1.md、command2.md）
- **フロントマター構造**: 基本的なc1/c2/c3コマンド階層
- **出力形式**: 導出されたavailableConfigs配列を含むJSON
- **スキーマ機能**: x-derived-from集約、x-derived-unique重複排除

**ファイル**:

- `registry_schema.json` - 導出フィールドを含む基本レジストリスキーマ
- `registry_template.json` - シンプルなJSON出力テンプレート
- `command1.md`、`command2.md` - サンプルコマンドMarkdownファイル
- `run.sh` - 実行スクリプト

**実行コマンド例**:

```bash
./cli.ts \
  examples/0.basic/registry_schema.json \
  "examples/0.basic/command*.md" \
  examples/0.basic/output.json \
  --verbose
```

**期待される出力構造**:

```json
{
  "version": "1.0.0",
  "description": "Basic command registry example",
  "tools": {
    "availableConfigs": ["git", "spec"],  // c1フィールドから導出
    "commands": [...]  // {@items}で展開
  }
}
```

### 1. Articles - 記事管理システム

**目的**: ブログ記事と技術文書のインデックス生成

**ユースケース**:
コンテンツ管理システム、ドキュメントサイト、ブログプラットフォーム

- メタデータを含む記事インデックスの自動生成
- 記事のカテゴリ、タグ、公開日の抽出と整理
- 検索可能な記事カタログの作成

**主な特徴**:

- **Markdownタイプ**: 技術記事、チュートリアル、ガイド文書
- **フロントマター構造**: タイトル、著者、日付、カテゴリ、タグ
- **出力形式**: JSON形式の記事インデックス
- **スキーマ機能**: シンプルな記事メタデータ構造

**ファイル**:

- `articles_schema.json` - 記事コレクションスキーマ
- `articles_template.json` - JSON形式出力テンプレート
- `docs/` - 実際の記事Markdownファイル
- `run.sh` - 実行スクリプト

**実行コマンド例**:

```bash
./cli.ts \
  ./articles_schema.json \
  "./docs/**/*.md" \
  ./articles-index-output.yml \
  --verbose
```

### 2. Climpt - コマンドレジストリシステム

**目的**: CLIツールのコマンド階層とドキュメントの管理

**ユースケース**: CLIツール開発、コマンドドキュメント、プロンプト管理

- CLIアプリケーションのコマンドレジストリ生成
- カテゴリ、アクション、ターゲット別にコマンドを整理
- 検索可能なコマンドドキュメントの作成

**主な特徴**:

- **Markdownタイプ**: コマンド定義、プロンプト文書
- **フロントマター構造**:
  階層的なc1（カテゴリ）/c2（アクション）/c3（ターゲット）構造
- **出力形式**: JSON形式のコマンドレジストリ
- **スキーマ機能**: 導出フィールド生成を伴う階層的コマンド分類

**ファイル**:

- `registry_schema.json` - コマンドレジストリスキーマ
- `registry_template.json` - JSON形式出力テンプレート
- `prompts/` - コマンド定義Markdownファイル
- `run.sh` - 実行スクリプト

**実行コマンド例**:

```bash
./cli.ts \
  ./registry_schema.json \
  "./prompts/**/*.md" \
  ./climpt-registry-output.json \
  --verbose
```

### 3. Docs - トレーサビリティ管理システム

**目的**: 要件、仕様、実装、テスト文書の追跡

**ユースケース**: ソフトウェア開発ライフサイクル管理、コンプライアンス追跡

- 要件と実装間のトレーサビリティマトリックス作成
- レベル別インデックス（要件、仕様、テスト）の生成
- 文書の関係と依存関係の追跡

**主な特徴**:

- **Markdownタイプ**: 要件仕様、設計文書、テスト仕様
- **フロントマター構造**: マルチレベル文書管理（req/spec/impl/test）
- **出力形式**: レベル別JSONインデックス
- **スキーマ機能**: トレーサビリティのための相互参照構造

**ファイル**:

- `index_*_schema.json` - レベル別スキーマファイル
- `index_level_template.json` - レベル別テンプレートファイル
- `docs/` - 仕様文書Markdownファイル
- `run.sh` - 実行スクリプト

**実行コマンド例**:

```bash
# 各トレーサビリティレベルの処理
for level in req spec design impl test; do
  ./cli.ts \
    "./index_${level}_schema.json" \
    "./docs/**/*.md" \
    "./index/${level}_index.json" \
    --verbose
done
```

## 共通の抽象化

これらの例は表面的には異なっていますが、共通の概念を共有しています：

1. **複数Markdownファイルからのメタデータ抽出**
2. **フロントマターの構造化データ変換**
3. **スキーマベースの検証と正規化**
4. **テンプレートベースの出力生成**
5. **自動インデックス/リスト生成**

## 主要要件の実装

`docs/requirements.ja.md`に基づき、これらの例は以下を実証しています：

### スキーマ駆動設計による柔軟性

- 各例は異なるスキーマとテンプレートを使用
- アプリケーションは異なるユースケースでも変更不要
- スキーマの置き換えにより異なるインデックス仕様に対応

### フロントマター処理機能

- `x-frontmatter-part`: ファイル単位処理のための配列識別
- `x-flatten-arrays`: 均一処理のための配列フラット化（オプション）
- `x-derived-from`: 他のプロパティからの値集約
- `x-template`と`x-template-items`: テンプレート指定

### 処理フェーズ

1. **個別ファイル処理**: 各Markdownファイルのフロントマター
2. **ファイル間統合**: 全ファイル処理完了後
3. **テンプレート展開**: 統合完了後

## 実行パターン

すべての例は同様の実行パターンに従います：

```bash
./cli.ts <schema> <input-pattern> <output> [options]
```

各パラメータ:

- `<schema>`: 構造と検証を定義するJSONスキーマファイル
- `<input-pattern>`: Markdownファイルのグロブパターンまたはディレクトリ
- `<output>`: 出力ファイルパス（拡張子で形式決定）
- `[options]`: `--template`、`--verbose`などの追加オプション

## 検証ポイント

これらの例は以下を検証しています：

- **汎用性**: 異なるドメインへの適用可能性
- **柔軟性**: 様々なスキーマ/テンプレート形式のサポート
- **拡張性**: x-frontmatter-part、x-derived-from拡張機能
- **実用性**: 実際のプロジェクトでの使用に適した品質

### 成功の確認方法

1. 各exampleディレクトリの`run.sh`を実行
2. 該当ディレクトリの`README.md`に記載された成功条件と照合
3. 期待される出力と実際の出力を比較
4. 数値的な成功指標（ファイル数、要素数等）を確認

## まとめ

`examples/`ディレクトリは生きたドキュメントとして機能し、frontmatter-to-schemaが単一のCLIツールでありながら、異なるドメインやユースケースにわたる多様な文書管理ニーズに対応できることを実証しています。
