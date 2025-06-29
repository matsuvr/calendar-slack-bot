/**
 * Calendar Slack Bot - メインサーバーファイル
 * カレンダー絵文字のリアクションからGoogleカレンダーのURLを生成するSlack Bot
 */

const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { config, validateConfig } = require('./src/config/config');
const { handleCalendarReaction } = require('./src/handlers/slackHandlers');

// 設定の検証
validateConfig();

// ExpressReceiverとエクスプレスアプリの初期化
let expressReceiver;
let expressApp;

if (config.app.demoMode) {
  // デモモードではシンプルなExpressアプリのみを使用
  console.log('⚠️ デモモードで起動します（SLACK_BOT_TOKENが設定されていません）');
  expressApp = express();
} else {  // 本番モードではSlack Boltと統合したExpressを使用
  try {    expressReceiver = new ExpressReceiver({
      signingSecret: config.slack.signingSecret || 'dummy-secret-for-startup',
      endpoints: '/slack/events', // Slack APIのRequest URLに合わせる
      processBeforeResponse: config.slack.processBeforeResponse,
    });
    expressApp = expressReceiver.app;
  } catch (receiverInitError) {
    console.error('ExpressReceiverの初期化に失敗しました:', receiverInitError);
    // 最小限のExpressアプリを作成して起動だけは成功させる
    expressApp = express();
  }
}

// デモモードではリクエストボディのパース用ミドルウェアを追加
if (config.app.demoMode) {
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));
}

// 基本的なエンドポイントの設定
expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// デモモード専用：カレンダーURL生成テスト用APIエンドポイント
if (config.app.demoMode) {
  const { createGoogleCalendarUrl } = require('./src/utils/calendarUtils');
  
  expressApp.post('/api/calendar-url', (req, res) => {
    try {
      const eventData = req.body;
      const calendarUrl = createGoogleCalendarUrl(eventData);
      
      res.json({
        success: true,
        url: calendarUrl,
        message: 'GoogleカレンダーURLが正常に生成されました'
      });
    } catch (error) {
      console.error('カレンダーURL生成エラー:', error);
      res.status(500).json({
        success: false,
        message: 'カレンダーURL生成に失敗しました',
        error: error.message
      });
    }
  });
}

// Slackのチャレンジリクエストとイベント処理に対応するエンドポイント
if (config.app.demoMode) {
  // デモモードの場合のみ、直接expressAppにルートを設定
  expressApp.post('/slack/events', async (req, res) => {
    // チャレンジパラメータがある場合はその値をそのまま返す
    if (req.body && req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }
    return res.status(200).send('OK');
  });
}

// server.jsの静的HTML部分を更新
// filepath: g:\WebstormProjects\calendar-slack-bot\server.js

// 静的サイトのHTMLを更新（GitHubリンクを追加）
expressApp.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Calendar Slack Bot</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          max-width: 1200px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .title {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 1.2rem;
          color: #666;
          margin-bottom: 20px;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          margin-bottom: 40px;
        }
        .feature-card {
          background: white;
          padding: 25px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 15px;
          display: block;
        }
        .feature-title {
          font-size: 1.3rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
        }
        .feature-desc {
          color: #666;
          line-height: 1.6;
        }
        .usage {
          background: #f8f9ff;
          padding: 30px;
          border-radius: 15px;
          margin-bottom: 30px;
        }
        .usage-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 20px;
          text-align: center;
        }
        .usage-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .usage-step {
          text-align: center;
          padding: 20px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }
        .step-number {
          font-size: 2rem;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 10px;
        }
        .footer {
          text-align: center;
          padding-top: 30px;
          border-top: 1px solid #eee;
          color: #666;
        }
        .tech-stack {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        .tech-item {
          background: #667eea;
          color: white;
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .links {
          margin-top: 20px;
        }
        .link {
          display: inline-block;
          margin: 0 15px;
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s ease;
        }
        .link:hover {
          color: #764ba2;
        }
        @media (max-width: 768px) {
          .title { font-size: 2rem; }
          .features { grid-template-columns: 1fr; }
          .usage-steps { grid-template-columns: 1fr; }
          .container { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">📅 Calendar Slack Bot</h1>
          <p class="subtitle">Gemini + Gemma ハイブリッドAI × 完全メモリ内処理 × サーバーレス設計</p>
        </div>

        <div class="features">
          <div class="feature-card">
            <span class="feature-icon">🚀</span>
            <h3 class="feature-title">AI-Powered 予定抽出</h3>
            <p class="feature-desc">Vertex AI (Gemini-2.5-flash) による高精度な自然言語処理で、Slackメッセージから予定情報を自動抽出</p>
          </div>

          <div class="feature-card">
            <span class="feature-icon">⚡</span>
            <h3 class="feature-title">高速メモリキャッシュ</h3>
            <p class="feature-desc">データベース不要の完全メモリ内処理。TTL付きキャッシュで重複処理を高速除去</p>
          </div>

          <div class="feature-card">
            <span class="feature-icon">🌐</span>
            <h3 class="feature-title">日本語処理最適化</h3>
            <p class="feature-desc">Slackマークアップ除去と全角文字対応。URL周りの空白調整で正確な解析を実現</p>
          </div>

          <div class="feature-card">
            <span class="feature-icon">🔄</span>
            <h3 class="feature-title">バッチ処理対応</h3>
            <p class="feature-desc">最大5件の予定を3件ずつ並列処理。効率的なリソース使用とユーザー体験の最適化</p>
          </div>

          <div class="feature-card">
            <span class="feature-icon">🔗</span>
            <h3 class="feature-title">ミーティングURL統合</h3>
            <p class="feature-desc">Google Meet、Teams、Zoom、Webex等の主要プラットフォームURLを自動検出・統合</p>
          </div>

          <div class="feature-card">
            <span class="feature-icon">🛡️</span>
            <h3 class="feature-title">セキュア＆リライアブル</h3>
            <p class="feature-desc">指数バックオフリトライ、エラーハンドリング、メモリ管理による安定運用</p>
          </div>
        </div>

        <div class="usage">
          <h3 class="usage-title">🎯 使い方</h3>
          <div class="usage-steps">
            <div class="usage-step">
              <div class="step-number">1</div>
              <p>Slackメッセージに<br/>📅 カレンダー絵文字で<br/>リアクション</p>
            </div>
            <div class="usage-step">
              <div class="step-number">2</div>
              <p>AI が自動的に<br/>予定情報を抽出<br/>（日時・場所・概要）</p>
            </div>
            <div class="usage-step">
              <div class="step-number">3</div>
              <p>Google Calendar<br/>登録リンクが<br/>スレッドに返信</p>
            </div>
            <div class="usage-step">
              <div class="step-number">4</div>
              <p>ワンクリックで<br/>カレンダーに<br/>予定を追加完了！</p>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="tech-stack">
            <span class="tech-item">Vertex AI (Gemini)</span>
            <span class="tech-item">Google AI Studio (Gemma)</span>
            <span class="tech-item">Cloud Run</span>
            <span class="tech-item">Node.js</span>
            <span class="tech-item">Slack API</span>
          </div>
          
          <p><strong>Powered by:</strong> Vertex AI + Google AI Studio + Cloud Run + Memory Cache</p>
          
          <div class="links">
            <a href="/health" class="link">🏥 Health Check</a>
            <a href="https://github.com/matsuvr/calendar-slack-bot" class="link" target="_blank">📋 GitHub Repository</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Expressサーバーを起動
let server;
try {
  server = expressApp.listen(config.server.port, () => {
    console.log(`✅ サーバーの起動成功: ポート ${config.server.port} でリッスン中`);
  });

  // サーバー起動のエラーハンドリング
  server.on('error', (error) => {
    console.error('サーバー起動エラー:', error);
  });
} catch (serverStartError) {
  console.error('Expressサーバーの起動に失敗しました:', serverStartError);
}

// デモモードの場合はここで処理を終了
if (config.app.demoMode) {
  console.log('デモモードで起動完了。Slack統合機能は無効化されています。');
} else if (process.env.NODE_ENV !== 'test') {
  // テスト環境でない本番モードの場合のみSlackアプリを初期化

  // Slackアプリの初期化
  let app;
  try {
    app = new App({
      token: config.slack.botToken,
      receiver: expressReceiver,
      processBeforeResponse: config.slack.processBeforeResponse,
    });    // リアクション追加イベントのハンドラー登録
    app.event('reaction_added', async ({ event, client }) => {
      console.log('🔄 reaction_added イベントを受信:', {
        reaction: event.reaction,
        user: event.user,
        channel: event.item?.channel,
        timestamp: event.item?.ts,
        item_type: event.item?.type
      });
      
      // バックグラウンドで処理を実行（イベントは自動的に応答される）
      setImmediate(async () => {
        try {
          await handleCalendarReaction({ event, client });
        } catch (error) {
          console.error('ハンドラー実行エラー:', error);
        }
      });
    });

    // 他のイベントも監視してデバッグ
    app.event(/.*/, async ({ event }) => {
      console.log('📥 受信したイベント:', event.type);
    });
    
    // アプリを起動
    (async () => {
      try {
        await app.start();
        console.log('✅ Slackアプリの起動に成功しました');
        
        // 終了シグナルのハンドリング
        ['SIGINT', 'SIGTERM'].forEach(signal => {
          process.on(signal, async () => {
            try {
              await app.stop();
              server.close();
              process.exit(0);
            } catch (error) {
              console.error('アプリ停止中にエラーが発生しました:', error);
              process.exit(1);
            }
          });
        });
      } catch (error) {
        console.error('Slackアプリの起動に失敗しました:', error);
        process.exit(1);
      }
    })();
  } catch (appInitError) {
    console.error('Slackアプリの初期化に失敗しました:', appInitError);
    process.exit(1);
  }
}

// テスト環境用のエクスポート
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    app: expressApp,
    server: server,
    closeServer: () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
      return Promise.resolve();
    }
  };
}