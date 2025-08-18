# M20: 配布チャネル（Docker/Homebrew/Chocolatey）

## Goal
- npm以外の主要チャネルでも配布し、導入摩擦を下げる。

## Scope（FR/NFR）
- FR: Dockerイメージ（distroless/最小）、Homebrew Tap、Chocolatey パッケージ
- NFR: イメージ小型化/再現性、署名/検証、CIで自動生成

## Deliverables
- `Dockerfile`/GHCR配布、brew tapリポジトリ、choco spec
- Release CI（タグで各チャネルへ配布）

## Tasks
- [ ] Docker build/push ワークフロー（最小実行例: analyze/import）
- [ ] brew/choco メタデータ作成と検証
- [ ] READMEにインストール手順を追記

## Definition of Done
- 3チャネルのうち Docker+Homebrew を安定提供、chocoはβでも可

## User-side Tasks（あなたの担当）
- Docker/GHCR: 組織/名前空間の確認、公開ポリシー、必要に応じてPAT権限の付与
- Homebrew: Tapリポジトリ（<org>/homebrew-tap）の用意と権限設定
- Chocolatey: アカウント作成/検証（メール/ドメイン）、承認フローの把握
