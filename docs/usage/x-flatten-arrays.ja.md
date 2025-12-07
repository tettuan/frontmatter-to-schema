# x-flatten-arrays ディレクティブ

## 概要

`x-flatten-arrays`は、`x-frontmatter-part`と組み合わせて使用するディレクティブで、フロントマター内のネストされた配列を抽出してフラット化します。

## 基本的な使い方

### スキーマ定義

```json
{
  "properties": {
    "traceability": {
      "type": "array",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "traceability",
      "items": {
        "$ref": "traceability_item_schema.json"
      }
    }
  }
}
```

### フロントマター

```yaml
---
traceability:
  - id:
      full: "design:ui:dashboard-1a2b3c#20250909"
      level: "design"
    summary: "Dashboard UI layout"
    status: "draft"
  - id:
      full: "design:ui:navigation-4d5e6f#20250909"
      level: "design"
    summary: "Navigation component"
    status: "approved"
title: "Dashboard UI Design Specification"
category: "UI Design"
priority: "SHOULD"
created_at: "2025-09-09"
---
```

### 出力結果

```json
{
  "traceability": [
    {
      "id": {
        "full": "design:ui:dashboard-1a2b3c#20250909",
        "level": "design"
      },
      "summary": "Dashboard UI layout",
      "status": "draft"
    },
    {
      "id": {
        "full": "design:ui:navigation-4d5e6f#20250909",
        "level": "design"
      },
      "summary": "Navigation component",
      "status": "approved"
    }
  ]
}
```

## 重要な注意点

### ⚠️ フロントマターの階層が失われる

`x-flatten-arrays`を使用すると、指定したプロパティ（この例では`traceability`）の配列要素のみが抽出されます。

**失われるデータ**:

- `traceability`プロパティ自体の階層
- 他のフロントマタープロパティ（`title`, `category`, `priority`,
  `created_at`など）

つまり、以下のようなフロントマター構造：

```yaml
traceability: [...] # ← この配列の中身のみが抽出される
title: "..." # ← 失われる
category: "..." # ← 失われる
priority: "..." # ← 失われる
```

結果として、`traceability`配列の**中身のみ**が出力されます。

## x-frontmatter-part との違い

### 標準のx-frontmatter-part（フラット化なし）

```json
{
  "articles": {
    "type": "array",
    "x-frontmatter-part": true
  }
}
```

**フロントマター**:

```yaml
title: "記事1"
emoji: "📝"
type: "tech"
```

**出力**:

```json
{
  "articles": [
    {
      "title": "記事1",
      "emoji": "📝",
      "type": "tech"
    }
  ]
}
```

→ **フロントマター全体がオブジェクトとして配列要素になる**

### x-frontmatter-part + x-flatten-arrays

```json
{
  "traceability": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability"
  }
}
```

**フロントマター**:

```yaml
traceability:
  - id: 1
  - id: 2
title: "ドキュメント"
```

**出力**:

```json
{
  "traceability": [
    { "id": 1 },
    { "id": 2 }
  ]
}
```

→
**フロントマター内の`traceability`配列の中身のみが抽出される**（`title`は失われる）

## 動作原理

`x-flatten-arrays`は以下の2つの処理を行います：

### 1. Extract（抽出）

フロントマター内の指定されたプロパティを取り出します。

```javascript
obj["traceability"]; // → [{id: 1}, {id: 2}]
```

### 2. Flatten（フラット化）

その配列を展開して、各要素を個別のアイテムとして扱います。

```javascript
flatMap((obj) => obj["traceability"]);
// → {id: 1}, {id: 2}（配列の各要素が展開される）
```

## 使用例

### 例1: トレーサビリティアイテムの収集

複数のマークダウンファイルに記載されたトレーサビリティ情報を1つの配列にまとめる場合。

**スキーマ**: `index_design_schema.json`

```json
{
  "properties": {
    "traceability": {
      "type": "array",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "traceability",
      "items": {
        "$ref": "traceability_item_schema.json"
      }
    }
  }
}
```

**マークダウンファイル** (`docs/design-1.md`, `design-2.md`, ...)

```yaml
---
traceability:
  - id: {full: "design:ui:dashboard-1a2b3c"}
    summary: "Dashboard layout"
  - id: {full: "design:ui:navigation-4d5e6f"}
    summary: "Navigation component"
title: "Dashboard Design"
---
```

**結果**:
全てのファイルの`traceability`配列要素が1つの配列にフラット化されます。

### 例2: レベルフィルタリングとの組み合わせ

```json
{
  "traceability": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability",
    "x-jmespath-filter": "[?id.level == 'design']",
    "items": {
      "$ref": "traceability_item_schema.json"
    }
  }
}
```

処理順序：

1. フロントマター内の`traceability`配列を抽出
2. 全ファイルの配列をフラット化
3. `x-jmespath-filter`でレベルが`design`のアイテムのみをフィルタ

## いつ使うべきか

### ✅ 使うべき場合

- **フロントマター内にネストされた配列がある**
- **その配列の要素のみを抽出したい**
- **フロントマターの他のフィールドは不要**

例:

```yaml
# 各ファイルに複数のトレーサビリティアイテムがある
traceability:
  - item1
  - item2
  - item3
```

### ❌ 使うべきでない場合

- **フロントマター全体をオブジェクトとして扱いたい**
- **フロントマターの他のフィールドも保持したい**

これらの場合は、標準の`x-frontmatter-part`のみを使用してください。

## トラブルシューティング

### Q: フロントマターの他のフィールドが失われる

**A**:
これは`x-flatten-arrays`の仕様です。指定したプロパティの配列要素のみが抽出されます。

他のフィールドも保持したい場合は、`x-flatten-arrays`を使用せず、標準の`x-frontmatter-part`のみを使用してください。

### Q: 配列が空になる

**A**:
フロントマター内に指定したプロパティ名の配列が存在しない可能性があります。

```yaml
# x-flatten-arrays: "traceability" と指定している場合
items: # ← プロパティ名が違う
  - item1
  - item2
```

この場合、`traceability`プロパティが見つからないため、空配列になります。

## まとめ

| 項目             | 標準のx-frontmatter-part   | x-frontmatter-part + x-flatten-arrays |
| ---------------- | -------------------------- | ------------------------------------- |
| **入力**         | フロントマター全体         | フロントマター内の指定配列            |
| **出力**         | オブジェクトの配列         | 配列要素の配列（フラット化）          |
| **階層**         | 保持される                 | 失われる                              |
| **他フィールド** | 保持される                 | 失われる                              |
| **用途**         | 各ファイル = 1オブジェクト | 各ファイル内の複数アイテム            |

`x-flatten-arrays`は、フロントマター内にネストされた配列を持つ特殊なケースで使用します。ほとんどの場合、標準の`x-frontmatter-part`のみで十分です。
