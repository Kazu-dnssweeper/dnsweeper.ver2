# M18: Web UI / レポーティング

## Goal
- CLIの出力を可視化し、結果のフィルタ/ソート/サマリ確認、エクスポートをWeb UIで行える。

## Scope（FR/NFR）
- FR: ローカル閲覧UI（静的/シングルバイナリ同梱も検討）、JSON読込/絞り込み/ダウンロード
- NFR: オフライン動作、XSS/CSRF対策（ローカル限定）、軽量で依存少なく

## Deliverables
- `ui/` 試作（Vite/React等） or 生成HTMLレポート（テンプレ）
- `dnsweeper report` コマンド（JSON→HTMLレポート）

## Tasks
- [ ] レポートテンプレ（Summary/High/All/TLS/Evidence）
- [ ] UIのPoC（ローカルファイル読込/検索/DL）
- [ ] エクスポートとの連携（CSV/XLSX/JSON再出力）

## Definition of Done
- JSON結果からクリック操作でハイリスクの絞り込み/詳細確認/エクスポートができる
