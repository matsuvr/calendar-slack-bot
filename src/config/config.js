/**
 * 環境設定を管理するモジュール
 */

require('dotenv').config();

// 基本設定
const config = {
  // サーバー設定
  server: {
    port: parseInt(process.env.PORT) || 8080,
  },
  
  // Slack設定
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    teamId: process.env.SLACK_TEAM_ID || '',
    workspaceName: process.env.SLACK_WORKSPACE_NAME || 'calendar-agent-test', // デフォルトワークスペース名
    processBeforeResponse: false, // イベントでは自動応答のためfalse
  },
  
  // Vertex AI設定
  vertexai: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.VERTEX_AI_LOCATION || 'us-central1', // テストで成功したロケーション
    models: {
      summarize: 'gemini-2.5-flash',
      extract: 'gemini-2.5-flash',
      lite: process.env.GEMINI_LITE_MODEL || 'gemma-3n-e4b-it'
    },
  },
  
  // Google AI Studio設定（Gemma 3n用）
  googleai: {
    apiKey: process.env.GEMINI_API_KEY,
    models: {
      lite: process.env.GEMINI_LITE_MODEL || 'gemma-3n-e4b-it'
    },
  },
  
  // アプリケーション設定
  app: {
    demoMode: !process.env.SLACK_BOT_TOKEN,
    maxEvents: 5,
  },
  
  // カレンダー設定
  calendar: {
    defaultDuration: 60, // 分単位
  },
  
  // 対応するカレンダー絵文字
  calendarReactions: [
    'calendar', 
    'カレンダー', 
    'calendar_spiral', 
    'date', 
    'カレンダーに入れる', 
    'calendar-bot'
  ],
};

// 必須環境変数のチェック
const validateConfig = () => {
  try {
    const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'GOOGLE_CLOUD_PROJECT', 'GEMINI_API_KEY'];
    const optionalEnvVars = ['SLACK_TEAM_ID']; // オプショナル環境変数
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    const missingOptionalVars = optionalEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`警告: 以下の環境変数が設定されていません: ${missingEnvVars.join(', ')}`);
      
      // Cloud Run環境での追加ガイダンス
      if (process.env.K_SERVICE) {
        console.warn('💡 Cloud Run環境では以下を確認してください:');
        console.warn('   1. gcloud run deploy時に --set-env-vars で環境変数を設定');
        console.warn('   2. サービスアカウントにVertex AI User権限を付与');
        console.warn('   3. Google AI Studio APIキーが有効');
      } else {
        console.warn('💡 ローカル開発環境では.envファイルまたは環境変数を設定してください');
      }
    } else {
      console.log('✅ 全ての必須環境変数が設定されています');
      
      // オプショナル環境変数の確認
      if (missingOptionalVars.length > 0) {
        console.log(`ℹ️  オプショナル環境変数（未設定）: ${missingOptionalVars.join(', ')}`);
        console.log('   単一ワークスペースでの使用では設定不要です');
      }
      
      // Cloud Run環境の検出とログ出力
      if (process.env.K_SERVICE) {
        console.log(`🏃 Cloud Run環境で実行中 (サービス: ${process.env.K_SERVICE})`);
        console.log('🔐 Vertex AI認証: サービスアカウントによる自動認証を使用');
      }
    }
  } catch (error) {
    console.error('環境変数チェック中にエラーが発生しました:', error);
  }
};

module.exports = {
  config,
  validateConfig,
};