# M9: クロスプラットフォーム対応 & インストールUX

## Goal
- Windows/macOS/Linux の3OSでインストール〜基本コマンドが安定動作し、導入に詰まらない。

## Scope（FR/NFR）
- FR: `bin`/改行コード/パス/権限の互換、PowerShell/WSL 検証、パス長/UTF-8 ハンドリング
- NFR: CI で 3OS スモーク（build+help+簡易 analyze）を常時検証

## Deliverables
- GitHub Actions: `windows-latest`/`macos-latest` のスモークジョブ
- README: OS別の注意点とトラブルシュート（権限/プロキシ/証明書）

## Tasks
- [ ] `bin/dnsweeper` の CRLF 問題/権限検証（Git 属性/自動変換）
- [ ] Node/PNPM セットアップの差異を吸収（setup-node/pnpm）
- [ ] 最小スモーク（`--help`/`import`/`list`）を 3OS で実行
- [ ] プロキシ/証明書ストアの既知問題を Docs に追記

## Definition of Done
- 3OS のCIが安定グリーン、READMEに導入ガイドとFAQが掲載されている
