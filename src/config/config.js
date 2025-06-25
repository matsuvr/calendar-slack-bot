/**
 * 環境設定を管理するモジュール
 */

require('dotenv').config();

// 基本設定
const config = {
  // Firestore設定
  firestore: {
    readonly: process.env.FIRESTORE_READONLY === 'true' || false,
    timeout: parseInt(process.env.FIRESTORE_TIMEOUT_MS) || 6000, // タイムアウト（ミリ秒）- 短縮
  },
  
  // サーバー設定
  server: {
    port: parseInt(process.env.PORT) || 8080,
  },
  // Slack設定
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    teamId: process.env.SLACK_TEAM_ID || '',
    processBeforeResponse: false, // イベントでは自動応答のためfalse
  },
    // Gemini AI設定
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    models: {
      summarize: 'gemini-2.5-flash-lite-preview-06-17',
      extract: 'gemini-2.5-flash-lite-preview-06-17',
      lite: process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite-preview-06-17'
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
    const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'GEMINI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`警告: 以下の環境変数が設定されていません: ${missingEnvVars.join(', ')}`);
    }
  } catch (error) {
    console.error('環境変数チェック中にエラーが発生しました:', error);
  }
};

module.exports = {
  config,
  validateConfig,
};