---
name: Template Output Clarification
about: Clarification on template processing behavior and output format
title: "[CLARIFICATION] Template defines exact output - no Schema inference"
labels: documentation, architecture, critical
assignees: ''

---

## Summary

テンプレート処理の基本原則について重要な明確化が必要です。**テンプレートファイルに記載された内容のみが出力される**という原則を、全てのドキュメントと実装で徹底する必要があります。

## Current Situation

現在、`.agent/spec-trace/traceability_item_template.json`には以下のみが記載されています：
```json
"{id.full}"
```

これは、配列の各要素が`id.full`の**値のみ**（文字列）として出力されることを意味します。

## Expected Behavior

### Case 1: 現在のテンプレート（`"{id.full}"`のみ）
```json
{
  "version": "1.0.0",
  "description": "Requirement level traceability IDs", 
  "req": [
    "req:api:deepresearch-3f8d2a#20250909",
    "req:ui:dashboard-5b7c9e#20250910"
  ]
}
```
配列要素は単純な文字列になります。

### Case 2: 完全なオブジェクトが必要な場合
テンプレートを以下のように定義する必要があります：
```json
{
  "id": {
    "full": "{id.full}",
    "level": "{id.level}",
    "scope": "{id.scope}",
    "semantic": "{id.semantic}",
    "hash": "{id.hash}",
    "version": "{id.version}"
  },
  "summary": "{summary}",
  "description": "{description}",
  "status": "{status}"
}
```

出力：
```json
{
  "version": "1.0.0",
  "description": "Requirement level traceability IDs",
  "req": [
    {
      "id": {
        "full": "req:api:deepresearch-3f8d2a#20250909",
        "level": "req",
        "scope": "api",
        "semantic": "deepresearch",
        "hash": "3f8d2a",
        "version": "20250909"
      },
      "summary": "DeepResearch API連携機能の要求定義",
      "description": "DeepResearchサービスをAPI経由で活用...",
      "status": "draft"
    }
  ]
}
```

## Critical Principle

### ✅ 正しい理解
- テンプレートは出力フォーマットを**完全に定義**する
- テンプレートに書かれたもの**のみ**が出力される
- 変数`{variable.path}`は値に置換される
- Schemaによる構造の補完は**一切行われない**

### ❌ 誤った理解
- Schemaの構造が出力構造を決める
- テンプレートが部分的な場合、Schemaで補完される
- x-frontmatter-part配列は特殊な処理を持つ
- テンプレートに書いていないフィールドも出力される

## Required Actions

1. **Documentation Update**
   - [ ] `docs/requirements.ja.md`に原則を明記
   - [ ] `docs/architecture/schema_process_architecture.ja.md`に詳細を追加
   - [ ] `docs/architecture/array-template-processing.md`を作成

2. **Template Files Review**
   - [ ] 全てのテンプレートファイルが意図した出力構造を**完全に**定義しているか確認
   - [ ] 特に配列処理のテンプレートを重点的にレビュー

3. **Test Cases**
   - [ ] テンプレート処理の原則を検証するテストケースを追加
   - [ ] 配列処理の出力が正しいことを確認するテストを作成

4. **Implementation Verification**
   - [ ] テンプレートエンジンがSchemaによる補完を行っていないことを確認
   - [ ] 配列処理でx-frontmatter-partが特殊処理を持たないことを検証

## Impact

この原則を正しく理解し実装しないと：
- 意図しない出力構造が生成される
- テンプレートの変更が期待通りに反映されない
- デバッグが困難になる
- ユーザーが混乱する

## References

- `docs/requirements.ja.md` - Lines 33-47 (テンプレート処理の基本原則)
- `docs/architecture/schema_process_architecture.ja.md` - Lines 11-47 (テンプレート処理の基本原則)
- `docs/architecture/array-template-processing.md` - 配列処理の詳細仕様

## Priority

**P0 - Critical**

この原則はシステムの根幹に関わるため、最優先で対応が必要です。