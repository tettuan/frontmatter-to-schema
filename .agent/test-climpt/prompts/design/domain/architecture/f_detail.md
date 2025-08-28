---
c1: design
c2: domain
c3: architecture
title: Detailed Domain Architecture Design
description: Detailed domain architecture design based on domain boundary information with comprehensive type definitions and implementation considerations.
usage: climpt-design domain architecture -a=detail -f domain_info.md -o detailed_design/
options:
  input: ["text", "file"]
  adaptation: ["default", "core", "detail"]
  input_file: [true]
  stdin: [false]
  destination: [true]
---

# ドメイン設計

「ドメイン情報」をもとに、ドメイン設計を行う。
実装情報を加味した、詳細な型定義を行う。

## 設計方針

- [全域性の原則](docs/totality_go.ja.md)を踏まえる。

# ドメイン情報

- ベースのドメイン情報: `docs/domain/*.md`
- 新しいドメイン情報: `{input_text_file}`
- 実装: Serena MCP で調査

# 出力先

`{destination_path}` へ出力。 (`{destination_path}`
がPATH形式でなければ、代わりに
`tmp/design_domain_architecture_detail/*.md`へ出力)

設計が複数ファイルへ分かれてもよい。
