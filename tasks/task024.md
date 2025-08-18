# v0.3.0: パッケージング/配布整備

## Goal
- 安定した配布と最小の再現性確保。

## Scope
- FR: Release CI（タグ→npm/Docker）、Cross-OS smoke。
- NFR: 署名付きタグ、CRLF/権限互換。

## Deliverables
- release.yml/ci-os.yml、RELEASING.md、CHANGELOG 自動生成（暫定可）。

## Tasks
- [ ] タグで自動 publish（npm/Docker）。
- [ ] `files`/`bin`/改行の最終調整（Win/macOS/Linux）。
- [ ] Cross-OS smoke（help/import）をCI導入。

## Definition of Done
- 主要OSでインストール〜helpが再現でき、タグで配布が完了する。

## Timeline / Owner / Dependencies
- 期日: TBD（GitHub Milestone v0.3.0）
- 担当: Maintainers
- 依存: v0.1.0/v0.2.0 の修正取り込み
