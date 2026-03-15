# dictate-site

AI 音声文字起こしサービス「Dictate」のランディングページ & API バックエンド。

## 概要

Gemini API を利用した音声文字起こし SaaS のプロダクトサイト。Stripe によるサブスクリプション決済、API キー発行、文字起こし API プロキシを提供する。

主な機能:
- ランディングページ（機能紹介、料金、デモ、FAQ）
- Stripe サブスクリプション決済
- Webhook による API キー自動発行（`dct_*` プレフィックス、SHA-256 ハッシュ保存）
- Gemini API 文字起こしプロキシ（Bearer トークン認証）
- カスタマーポータル（サブスクリプション管理）

## セットアップ

```bash
cp .env.example .env.local
npm install
```

### 環境変数（`.env.local`）

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID=price_xxx
GEMINI_API=xxx
SITE_URL=https://dictate-site.vercel.app
```

## 使い方

```bash
# ローカル開発
vercel dev

# デプロイ
vercel deploy
```

### API エンドポイント

| エンドポイント | 用途 |
|--------------|------|
| `POST /api/checkout` | Stripe Checkout セッション作成 |
| `POST /api/webhook` | Stripe Webhook（キー発行） |
| `POST /api/transcribe` | 音声文字起こし（Bearer 認証） |
| `POST /api/verify-session` | API キー取得 |
| `POST /api/manage-subscription` | カスタマーポータル |

## 技術スタック

- **Frontend**: Static HTML（ダークテーマ）
- **Backend**: Vercel Functions (Node.js)
- **決済**: Stripe（サブスクリプション、Webhook）
- **AI**: Google Gemini API
- **Hosting**: Vercel
