---
title: 修正指示を文書化する
description: 問題点をまとめ、次の修正指示をGitのIssueへ登録する
usage: climpt-git document fix-instruction
variables:
  input_text: 問題の内容と修正の方向性など
---

# 指示:「修正指示を文書化しIssueへ登録する」

「大筋の内容」をもとに、修正指示を作成し、GitHubへ gh で issue 作成して。

- 不具合修正のため、 bug ラベルをつけること。
- 問題の修正の方向性は、「修正方針」を参照すること。

## 大筋の内容

{input_text}

## 修正方針

まず、以下の方針をIssueへも転記する。

1. [requirements](docs/requirements.ja.md) に従い、要求を満たすこと。
2. [Totality](docs/development/totality.ja.md)とドメイン駆動設計(docs/domain/*)に基づくこと。
3. [hardcording](docs/development/prohibit-hardcoding.ja.md)は禁止。
4. [AI実装複雑化防止](docs/development/ai-complexity-control_compact.ja.md)に従うこと。

上記を理解したうえで、「大筋の内容」を分析する。

- 起きている問題を整理
- その領域で分類
- 分類ごとの解決すべき課題の個数を把握
- 解決すべき課題の列挙

問題の種類でグルーピングしたあと、各問題領域ごとに Issue
作成用の文章を作成し、gh で Issue 作成する。
