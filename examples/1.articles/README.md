# 1.articles - 記事管理システム

ブログ記事や技術文書のメタデータを管理し、インデックスを生成する実用的な例です。

## 概要

複数の記事Markdownファイルからメタデータを抽出し、統合されたインデックスを生成します。

## 成功の定義

### 1. フロントマター抽出の成功

#### 必須フィールド

- `title`: 全記事でタイトルが抽出される
- `type`: tech/ideaの分類が全記事で取得される
- `published`: 公開状態のブール値が全記事で取得される

#### オプションフィールド

- `emoji`: 存在する場合は抽出される
- `topics`: 配列形式で正しく処理される
- `published_at`: ISO 8601形式の日時として処理される

#### 自動生成フィールド

- `filename`: 処理中のファイル名が自動付与される
- `created_date`: ファイル名から日付部分（YYYY-MM[-DD]形式）が抽出される

### 2. スキーマ検証の成功

- 全20記事が`article_schema.json`の定義に準拠する
- 必須フィールド（title, type, published）が全記事に存在する
- 日付形式がpattern `^\\d{4}-\\d{2}(-\\d{2})?$` に適合する

### 3. x-frontmatter-part処理の成功

- `articles`配列に20個の記事オブジェクトが収集される
- 各記事が独立したオブジェクトとして格納される
- ファイル名のアルファベット順で処理される

### 4. x-derived-from処理の成功

#### topics配列

- 全記事の`topics`フィールドから値が収集される
- ネストした配列がフラット化される
- `x-derived-unique: true`により重複が削除される
- ユニークなトピックのみの配列が生成される

#### types配列

- 全記事の`type`フィールドから値が収集される
- `x-derived-unique: true`により重複が削除される
- 結果として`["idea", "tech"]`の2要素の配列となる

### 5. テンプレート展開の成功

- `{generated_at}`: 処理実行時のISO 8601形式タイムスタンプ
- `{@items}`: articles配列の各要素が`article_template.json`で展開される
- `{topics}`: 集約されたユニークなトピック配列
- `{types}`: 集約されたユニークなタイプ配列
- 出力形式: YAML（`x-template-format: "yaml"`により）

## 期待される出力

```yaml
generated_at: "2025-01-27T10:30:00Z" # 実行時のタイムスタンプ
articles:
  - title: "記事タイトル1"
    emoji: "📝"
    type: "idea"
    topics: ["AI", "Cursor", "Claude"]
    published: false
    published_at: null
    filename: "2025-02-xxx.md"
    created_date: "2025-02"

  - title: "記事タイトル2"
    emoji: "🔧"
    type: "tech"
    topics: ["TypeScript", "DDD"]
    published: true
    published_at: "2025-03-03T10:00:00Z"
    filename: "2025-03-03-xxx.md"
    created_date: "2025-03-03"

  # ... 全20記事

topics: # 全記事から重複なく集約
  - "AI"
  - "Architecture"
  - "Claude"
  - "DDD"
  - "TypeScript"
  # ... その他のユニークトピック

types: # 全記事から重複なく集約
  - "idea"
  - "tech"
```

## 成功指標

### 数値基準

- **記事数**: 20個の記事が処理される
- **タイプ数**: 2種類（"tech", "idea"）
- **トピック数**: 重複削除後のユニークな値のみ
- **必須フィールド充足率**: 100%

### 処理の正確性

- ファイル名から日付が正しく抽出される
- 配列のフラット化と重複削除が正しく動作する
- YAMLフォーマットで出力される
- タイムスタンプが自動生成される

## 実行コマンド

```bash
# プロジェクトルートから
bash examples/1.articles/run.sh

# または直接実行
./cli.ts \
  examples/1.articles/articles_schema.json \
  "examples/1.articles/docs/**/*.md" \
  examples/1.articles/articles-index-output.yml
```
