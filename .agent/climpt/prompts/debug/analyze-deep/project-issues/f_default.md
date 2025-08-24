---
title:プロジェクト全体の深掘り調査と修正タスク洗い出し
---

# 指示:

以下の2点を実施して。
1. プロジェクト全体を深く調査し、リファクタ課題や重複コード、修正すべき問題を洗い出して。
2. ドメイン駆動設計からテスト駆動設計へ進め、テストが要求や仕様書を反映していない箇所を洗い出して。カバレッジよりも仕様のテスト反映を優先すべき。

## 強固構築方針

- **ドメイン駆動設計**: ビジネスロジックとドメインモデルを中核とした堅牢な設計
- **全域性原則**:
  型安全性による不正状態の完全排除（`docs/development/totality_go.ja.md`参照）
- **強固性重視**: 障害耐性、保守性、拡張性を重視した堅牢な構築
- [AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)

## 必須参照資料

必ず以下の資料を参照してから強固な設計・実装を開始すること：

1. **ドメイン設計**: `docs/domain/domain_boundary-*.md`
2. **サブドメイン設計**: `docs/domain/architecture/**/*.md`
3. **全域性原則**: `docs/development/totality_go.ja.md`
4. **テスト方針**: `docs/tests/README.md`, `docs/tests/testing_guidelines.md`

# 課題がある場合

gh で 適切なラベルをつけてIssueを作って。

## ラベル

[bug, ci-failure, duplicate, enhancement, refactor, documentation,
priority-high]

# 何も課題がない場合

ひとつも問題がなく、修正も全て完了している場合は、リリースIssueを作成する。

gh で ラベル "release" を含む Issueを作成して。 全部で30行以内に収めること。

Issueへの登録内容:

- Releaseノートに含める文言
- 実装が確認された内容のサマリー
