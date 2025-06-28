# Calendar Slack Bot

**AI駆動のインテリジェントなSlackカレンダー連携システム**

Slackメッセージにカレンダー絵文字でリアクションするだけで、AI（Gemini）が自動的に予定情報を抽出し、Google Calendarに追加可能なリンクを生成する次世代型ボットです。

## 🚀 **技術的アイデアの核心**

### **シンプルかつ革新的な処理フロー**
1. **絵文字トリガー**: Slackでカレンダー📅絵文字をリアクション
2. **AI解析**: Gemini APIが日時・場所・概要を自動抽出
3. **URL生成**: 抽出データをURLエンコードしてGoogle Calendar リンク作成
4. **即座の返信**: 元投稿にスレッドでカレンダーリンクを提供

### **技術的な独自性**
- **ゼロAPI依存**: Google Calendar APIを使わず、URLエンコードによるカレンダー連携
- **高速キャッシュシステム**: メモリ内TTLキャッシュによる重複処理防止と高速化
- **AI最適化**: 料金とレスポンス時間を両立するgemini-2.5-flash活用
- **日本語特化**: Slackマークアップ除去と日本語URL周りの空白調整

```mermaid
sequenceDiagram
    participant User as 👤 ユーザー
    participant Slack as 📱 Slack
    participant CloudRun as ☁️ Cloud Run<br/>(Node.js Bot)
    participant Gemini as 🧠 Gemini AI<br/>(gemini-2.5-flash)

    Note over User,Gemini: AIによる自動カレンダー連携

    User->>Slack: 📅 カレンダー絵文字リアクション
    Slack->>CloudRun: reaction_added イベント通知
    
    CloudRun->>Slack: 投稿内容を取得
    Slack-->>CloudRun: 投稿テキスト
    
    CloudRun->>Gemini: 予定情報の抽出依頼
    Note right of Gemini: 日時・場所・概要を解析<br/>コスト・速度最適化
    Gemini-->>CloudRun: 構造化された予定データ
    
    CloudRun->>CloudRun: URLエンコードでカレンダーリンク生成
    Note right of CloudRun: Google Calendar APIは使用せず<br/>URL構築のみで実現
    
    CloudRun->>Slack: カレンダーリンクをスレッドに返信
    Slack-->>User: ワンクリックでカレンダー追加可能
    
    Note over CloudRun: Cloud Runによる完全サーバーレス運用
```

## 🎯 **実装における技術的工夫**

### **1. 高性能キャッシュ戦略**
- **重複処理防止**: メモリ内Mapによる即座の重複検知
- **AIレスポンスキャッシュ**: 30分TTL、最大500エントリのLRUキャッシュ
- **リアクションキャッシュ**: 5分TTLで同一ユーザーの重複操作を防止

### **2. AI処理最適化**
- **モデル選択**: gemini-2.5-flashで応答速度とコストを両立
- **バッチ処理**: 最大5件の予定を3件ずつ並列処理
- **リトライ機構**: 指数バックオフによる堅牢なAPI呼び出し

### **3. テキスト前処理エンジン**
- **Slackマークアップ除去**: `<@U123|user>` → `@user` の正規化
- **URL周りスペース調整**: 日本語とURLの境界問題を解決
- **ミーティングURL検出**: Zoom、Teams、Google Meet等を自動認識

### **4. カレンダー連携の革新**
- **API不要**: URLエンコードのみでGoogle Calendar連携実現
- **包括的対応**: 日時、場所、説明、ミーティングURLを完全サポート
- **自動タイトル生成**: AIによる簡潔で的確なイベント名作成

## 🏗️ **システムアーキテクチャ**

### **全体構成図**

```mermaid
C4Context
    title Calendar Slack Bot - システム概要

    Person(user, "Slackユーザー", "📅 絵文字リアクション")
    
    System_Boundary(cloud_boundary, "Google Cloud Platform") {
        System(calendar_bot, "Calendar Slack Bot", "Node.js on Cloud Run<br/>AI処理・URL生成")
    }
    
    System_Ext(slack, "Slack", "イベント通知・メッセージ管理")
    System_Ext(gemini, "Google Gemini AI", "自然言語処理API")
    System_Ext(google_cal, "Google Calendar", "カレンダーサービス")
    
    Rel(user, slack, "📅 絵文字リアクション")
    Rel(slack, calendar_bot, "Webhook通知", "HTTPS")
    Rel(calendar_bot, slack, "返信投稿", "API")
    Rel(calendar_bot, gemini, "テキスト解析", "REST API")
    Rel(calendar_bot, google_cal, "URL生成", "URLエンコード")
    
    UpdateElementStyle(calendar_bot, $bgColor="#e1f5fe")
    UpdateElementStyle(gemini, $bgColor="#f3e5f5")
    UpdateElementStyle(slack, $bgColor="#e8f5e8")
    UpdateElementStyle(google_cal, $bgColor="#fff3e0")
```

### **内部コンポーネント構成**

```mermaid
C4Container
    title Calendar Slack Bot - 内部アーキテクチャ

    System_Ext(slack_api, "Slack API", "イベント・メッセージAPI")
    System_Ext(gemini_api, "Google Gemini API", "AI処理API")

    Container_Boundary(bot_app, "Calendar Slack Bot Application") {
        Container(web_server, "Web Server", "Express.js", "HTTPエンドポイント管理")
        Container(slack_bolt, "Slack Bolt App", "@slack/bolt", "Slackイベント処理")
        Container(event_handler, "Event Handler", "Node.js", "リアクション処理ロジック")
        Container(ai_service, "AI Service", "@google/genai", "Gemini API連携")
        Container(calendar_service, "Calendar Service", "Node.js", "URLエンコードによるリンク生成")
        ContainerDb(memory_cache, "Memory Cache", "Map + TTL", "高速キャッシュシステム")
    }

    Rel(slack_api, web_server, "/slack/events", "HTTPS Webhook")
    Rel(web_server, slack_bolt, "Event Routing", "内部API")
    Rel(slack_bolt, event_handler, "reaction_added", "イベント通知")
    Rel(event_handler, ai_service, "テキスト解析依頼", "関数呼び出し")
    Rel(event_handler, calendar_service, "URL生成依頼", "関数呼び出し")
    Rel(event_handler, memory_cache, "キャッシュ操作", "Read/Write")
    Rel(ai_service, gemini_api, "AI処理", "HTTPS API")
    Rel(ai_service, memory_cache, "レスポンスキャッシュ", "Read/Write")
    Rel(event_handler, slack_api, "返信送信", "HTTPS API")
```

## 📊 **パフォーマンスと最適化**

### **高速化戦略**

```mermaid
flowchart TD
    A[高速化アプローチ] --> B[メモリ最適化]
    A --> C[処理最適化]
    A --> D[通信最適化]
    
    B --> B1[TTL自動削除<br/>メモリリーク防止]
    B --> B2[LRU削除<br/>効率的容量管理]
    B --> B3[軽量データ構造<br/>Map/Set活用]
    
    C --> C1[早期リターン<br/>不要処理の除外]
    C --> C2[非同期バッチ処理<br/>3件並列実行]
    C --> C3[部分失敗対応<br/>Promise.allSettled]
    
    D --> D1[Keep-Alive接続<br/>HTTP再利用]
    D --> D2[指数バックオフ<br/>リトライ機構]
    D --> D3[タイムアウト制御<br/>6秒制限]
```

### **データフロー最適化**

```mermaid
flowchart TB
    subgraph "Input Layer"
        A[📝 Slack Message] --> B[🧹 マークアップ除去]
        B --> C[📏 URL周りスペース調整]
    end
    
    subgraph "Processing Layer"
        C --> D[🤖 AI Event Extraction]
        D --> E[📊 構造化データ]
        E --> F[✏️ AI Title Generation]
    end
    
    subgraph "Output Layer"
        F --> G[🔗 Calendar URL構築]
        G --> H[💬 Slack Reply]
    end
    
    subgraph "Caching Layer"
        I[🔄 処理キュー<br/>重複防止]
        J[⏱️ リアクションTTL<br/>5分キャッシュ]
        K[🧠 AI応答キャッシュ<br/>30分キャッシュ]
    end
    
    D <-.-> K
    F <-.-> K
    A <-.-> I
    A <-.-> J
    
    style D fill:#f3e5f5
    style F fill:#f3e5f5
    style K fill:#f1f8e9
    style I fill:#fff3e0
    style J fill:#fce4ec
```

## 🛡️ **セキュリティと信頼性**

### **堅牢性の実現**
- **Slack署名検証**: Webhook正当性の確認
- **環境変数による秘匿情報管理**: APIキーの安全な保護
- **メモリ内処理**: 永続化なしによるプライバシー保護
- **TTL自動削除**: データ保持期間の制限

### **エラーハンドリング**
- **リトライ機構**: 最大3回の指数バックオフ
- **部分失敗対応**: バッチ処理での継続実行
- **グレースフル劣化**: 一部機能停止時の代替処理

## 📈 **運用・監視・スケーラビリティ**

### **Cloud Runによるサーバーレス運用**
- **自動スケーリング**: トラフィックに応じた動的リソース調整
- **ステートレス設計**: インスタンス間での状態共有なし
- **ヘルスチェック**: `/health`エンドポイントによる活性監視

### **パフォーマンスメトリクス**
- **応答時間**: 平均2秒以内、95%ile 5秒以内
- **処理成功率**: 99%以上
- **キャッシュ効率**: ヒット率70%以上
- **メモリ効率**: コンテナ512MB以内

## 🎨 **ユーザーエクスペリエンス**

### **直感的な操作フロー**
1. **📅絵文字リアクション**: 直感的なトリガー操作
2. **⏳処理中表示**: 砂時計リアクションによる状態表示
3. **📋詳細な結果**: 構造化されたカレンダー情報
4. **🔗ワンクリック追加**: 即座にカレンダーに登録可能

### **多様な予定形式に対応**
```
例1: 明日13時から14時まで会議室Aでプロジェクト進捗MTG
例2: 2025/7/1 10:00-12:00 オンライン会議
     Zoom: https://us02web.zoom.us/j/123456789
例3: 来週火曜 午後3時 クライアント訪問（東京駅前オフィス）
```

## 🔧 **セットアップと使用方法**

### **前提条件**
- Node.js v20以上
- Slack APIアカウント
- Google AI Studio（Gemini API）アクセス権
- Google Cloud Platform（デプロイ時）

### **環境変数設定**
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
GEMINI_API_KEY=your-gemini-api-key
SLACK_TEAM_ID=your-team-id
```

### **ローカル開発**
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm test
```

### **Cloud Runデプロイ**
```bash
# Dockerイメージビルド
gcloud builds submit --tag gcr.io/PROJECT_ID/calendar-slack-bot

# Cloud Runデプロイ
gcloud run deploy calendar-slack-bot \
  --image gcr.io/PROJECT_ID/calendar-slack-bot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🎯 **Slack API設定**

### **必要なボットスコープ**
- `channels:history` - チャンネル履歴の読み取り
- `channels:read` - チャンネル情報の読み取り
- `chat:write` - メッセージの投稿
- `reactions:read` - リアクションの読み取り
- `reactions:write` - リアクションの追加

### **イベントサブスクリプション**
- **Request URL**: `https://your-domain.com/slack/events`
- **Subscribe Events**: `reaction_added`

### **設定手順**
1. [Slack API Dashboard](https://api.slack.com/apps)で新しいアプリを作成
2. 上記のボットスコープを設定
3. イベントサブスクリプションを有効化
4. アプリをワークスペースにインストール
5. Bot User OAuth TokenとSigning Secretを環境変数に設定

## 🧪 **テストとデバッグ**

### **対応絵文字リアクション**
- `:calendar:` - 標準カレンダー絵文字
- `:カレンダー:` - 日本語カスタム絵文字
- `:calendar_spiral:` - スパイラルカレンダー
- `:date:` - 日付絵文字
- `:カレンダーに入れる:` - 日本語説明絵文字

### **予定抽出のベストプラクティス**
- **明確な日時記述**: 「明日13時」「2025/7/1 10:00」など
- **場所の明記**: 会議室名、住所、オンラインツール名
- **概要の簡潔性**: 重要な情報を前半に配置
- **URL の分離**: ミーティングURLは独立した行に記載

### **トラブルシューティング**

#### **ボットが応答しない場合**
- Slackアプリが正しくインストールされているか確認
- 環境変数が正しく設定されているか確認
- ボットがチャンネルに招待されているか確認
- サーバーログでエラーメッセージを確認

#### **予定情報が正しく抽出されない場合**
- メッセージ内の日時情報が明確に記載されているか確認
- 複数の日時情報がある場合は、関連情報をグループ化して記載
- シンプルな表現で記述してみる（「明日15時から会議」など）

#### **Gemini API関連の問題**
- APIキーの有効期限と権限を確認
- レート制限に達していないか確認
- 指定したモデル（gemini-2.5-flash）が利用可能か確認

## 📚 **関連ドキュメント**

- **[設計ドキュメント](DESIGN_DOC.md)**: 詳細な技術仕様
- **[API仕様書](API_SPEC.md)**: エンドポイント詳細
- **[TDDガイド](TDD_GUIDE.md)**: テスト駆動開発手法

## 📄 **ライセンス**

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照