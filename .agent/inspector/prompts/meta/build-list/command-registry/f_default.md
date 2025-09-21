---
c1: meta
c2: build-list
c3: command-registry
title: inspector Executable Commands List Builder
description: Creates a comprehensive list of available inspector commands by scanning executable commands, configuration files, and prompt files.
usage: inspector-meta build-list command-registry
options:
  destination: false
  file: false
  stdin: false
---

# 実施事項

使用可能な inspector リストを作成する。

bash:
`frontmatter-to-schema .agent/climpt/frontmatter-to-json/registry_schema.json ".agent/inspector/prompts/**/*.md" .agent/inspector/registry.json`
