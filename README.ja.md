# カンバンメモアプリ

日々の活動をサポートする軽量カンバン形式のタスク管理アプリです。ドラッグ&ドロップ、タグ、複数ビューを備え、ブラウザだけでタスクをセッション単位で管理できます。

## 機能

- **カンバンボード** — Todo / 作業中 / 待ち / 完了 の4列構成
- **リストビュー** — コンパクトな一覧表示、ドラッグハンドルで並べ替え
- **セッション管理** — セッションの開始・終了、未完了タスクの自動引き継ぎ
- **ドラッグ&ドロップ** — タスクの列間移動、タグのドラッグ割り当て（SortableJS）
- **タグシステム** — タグの作成・名前変更・削除、タスクへの割り当て
- **タスク編集** — クリックで詳細モーダル、ダブルクリックでインライン編集
- **モバイル対応** — レスポンシブデザイン、カラムタブ切替、ボトムシートのタグドロワー
- **PWA** — モバイルのホーム画面に追加してアプリとして利用可能
- **パスワード保護** — オプションのトークンベース認証
- **デュアルストレージ** — ローカルSQLite（デフォルト）またはTursoクラウドDB

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Vanilla HTML / CSS / JavaScript |
| バックエンド | Node.js + Express |
| データベース | SQLite（[@libsql/client](https://github.com/tursodatabase/libsql-client-ts)） |
| ドラッグ&ドロップ | [SortableJS](https://sortablejs.github.io/Sortable/)（CDN） |

## クイックスタート（ローカル）

```bash
git clone https://github.com/tkpurine/kanban-memo-app.git
cd kanban-memo-app
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開き、SQLiteデータベースの保存先フォルダを指定してください（例: `~/kanban-data`）。

## 設定

`.env.example` を `.env` にコピーして編集します：

```bash
cp .env.example .env
```

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `PORT` | サーバーポート | `3000` |
| `APP_PASSWORD` | ログインパスワード（設定で認証有効化） | *（空 = 認証なし）* |
| `STORAGE_FOLDER` | ストレージフォルダの自動設定（モーダルをスキップ） | *（空）* |
| `TURSO_DATABASE_URL` | TursoクラウドDBのURL | *（空 = ローカルモード）* |
| `TURSO_AUTH_TOKEN` | Turso認証トークン | *（空）* |

### ストレージフォルダの自動設定

起動時のフォルダ選択モーダルをスキップするには、`STORAGE_FOLDER` を設定します：

```bash
STORAGE_FOLDER=~/kanban-data npm run dev
```

## 使い方

### ビュー

- **ボードビュー** — 4つのカンバン列間でタスクをドラッグ移動
- **リストビュー** — ≡ ハンドルをドラッグして並べ替え、ドロップダウンでステータス変更

### タスク

- **追加**: 入力欄にテキストを入力し `Cmd+Enter`（または `Ctrl+Enter`）
- **編集**: タスクをクリックで詳細モーダル、ダブルクリックでインライン編集
- **削除**: 詳細モーダルを開いて削除ボタン
- **タグ割り当て**: サイドバーからタグをタスクにドラッグ、または詳細モーダルのドロップダウンから選択

### タグ

- **作成**: サイドバーの入力欄に名前を入力し「+ Add」をクリック
- **名前変更**: サイドバーのタグにホバーして ✎ アイコンをクリック
- **削除**: タグ編集モーダルで削除ボタン（全タスクから自動的に除去）

### セッション

**+ New Session** をクリックすると新しいセッションが開始されます。「Done」以外のタスクは自動的に新セッションに引き継がれます。

## 応用編: クラウドデプロイ（Render + Turso）

外出先からもアクセスしたい場合、[Render](https://render.com) と [Turso](https://turso.tech) を使ってクラウドにデプロイできます。どちらも無料枠があり、クレジットカード不要です。

### 1. Tursoデータベースの作成

```bash
# Turso CLIのインストール
curl -sSfL https://get.tur.so/install.sh | bash

# アカウント作成 / ログイン
turso auth signup
turso auth login

# データベース作成（近いリージョンを選択）
turso db create kanban-memo --region aws-ap-northeast-1

# 接続情報の取得
turso db show kanban-memo --url
turso db tokens create kanban-memo
```

### 2. Renderへのデプロイ

1. GitHubにリポジトリをプッシュ
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
3. GitHubリポジトリを接続
4. 設定:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 環境変数を追加:
   - `TURSO_DATABASE_URL` — `turso db show` で取得したURL
   - `TURSO_AUTH_TOKEN` — `turso db tokens create` で取得したトークン
   - `APP_PASSWORD` — アプリを保護するパスワード
6. デプロイ

> **注意**: Tursoモード使用時は `STORAGE_FOLDER` を設定しないでください。`TURSO_DATABASE_URL` が設定されていれば自動的にTursoモードとして動作し、フォルダ設定モーダルはスキップされます。

### アーキテクチャ

```
ローカルモード:  ブラウザ  →  Express  →  SQLiteファイル（ローカルフォルダ）
クラウドモード:  ブラウザ  →  Express (Render)  →  Turso (クラウドSQLite)
```

[@libsql/client](https://github.com/tursodatabase/libsql-client-ts) により、ローカルSQLiteファイルとTursoクラウドDBの両方を同一APIで透過的にサポートしています。

## プロジェクト構成

```
src/
├── client/
│   ├── index.html          # シングルページアプリ
│   ├── css/style.css       # Apple風レスポンシブスタイル
│   ├── js/app.js           # クライアントロジック、SortableJS設定
│   ├── sw.js               # Service Worker（PWA、ネットワークファーストキャッシュ）
│   ├── manifest.json       # PWAマニフェスト
│   └── icons/              # アプリアイコン
└── server/
    ├── index.js            # Expressアプリ、静的ファイル配信、設定
    ├── routes.js           # REST APIエンドポイント
    ├── queries.js          # データアクセス層（libSQL）
    ├── db.js               # データベース初期化
    └── auth.js             # トークンベース認証
```

## APIエンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/session/current` | 現在のセッションを取得（なければ作成） |
| POST | `/api/session/new` | 新セッション開始（タスク引き継ぎ） |
| POST | `/api/task` | タスク作成 |
| PUT | `/api/task/:id` | タスク更新（内容・ステータス・タグ） |
| DELETE | `/api/task/:id` | タスク削除 |
| PUT | `/api/tasks/order` | タスク並べ替え |
| DELETE | `/api/task/:id/tags/:tagId` | タスクからタグを除去 |
| GET | `/api/tags` | 全タグ一覧 |
| POST | `/api/tags` | タグ作成 |
| PUT | `/api/tags/:id` | タグ名変更 |
| DELETE | `/api/tags/:id` | タグ削除 |

## ドキュメント

- [仕様書](docs/spec.md)

## ライセンス

MIT

---

[English README](README.md)
