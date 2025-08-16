# M4: HTTP Prober & 合算スコア

## Goal
- 対象ホストの HTTP/HTTPS 到達性を観測（HEAD→失敗時 GET）、結果を Evidence に反映し、Risk Engine と合算。

## Scope（FR/NFR）
- FR-006, FR-007／NFR-001, NFR-005

## Deliverables
- `src/core/http/probe.ts`（timeout/redirect/tls 最小情報）
- `src/core/http/types.ts`
- `src/core/risk/rules.ts` の HTTP 系規則（R-005）
- 統合テスト（ネットワーク実行可能な軽量サイトを Fixture に）

## Tasks
- [ ] HTTP クライアント選定（node:https + fetch or undici）
- [ ] オプション反映：timeout, maxRedirects, method, userAgent 既定
- [ ] リダイレクト追跡（回数/最終URL/ステータス）
- [ ] TLS 情報の最小抽出（ALPN/Issuer/SNI 記録）
- [ ] URL 候補生成（A/AAAA/CNAME → http(s)://name、SRV → 最終 FQDN）
- [ ] 失敗分類（timeout / dns / tls / net / 4xx / 5xx）
- [ ] Evidence 生成（HTTP 404/timeout 等を message に、詳細は meta）
- [ ] ジョブランナーと直列連携（DNS→HTTP の順）
- [ ] R-005 スコア合算の実装・テスト
- [ ] サンプル CSV で e2e 実行・結果検証

## Tests
- [ ] 200 → Evidence なし（到達性OK）
- [ ] 404 → R-005 +15
- [ ] timeout → R-005 +15（ただし単独で high にしない）
- [ ] 最大リダイレクト超過 → エラー種別 correct

## Definition of Done
- `--http-check` 有効時のみ実行
- ネットワーク障害でもプロセス継続、失敗は Evidence へ
- レポートに HTTP 列が反映される（status, redirects, elapsedMs）
