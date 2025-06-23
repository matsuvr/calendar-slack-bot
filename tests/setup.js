/**
 * Jest テストセットアップファイル
 * 全テストで共通で使用する設定やモックを定義
 */

// 環境変数のテスト用設定
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.FIRESTORE_PROJECT_ID = 'test-project';

// コンソールログの抑制（必要に応じて）
if (process.env.SUPPRESS_LOGS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// グローバルなテストタイムアウト設定
jest.setTimeout(10000);

// テスト前後のクリーンアップ
beforeEach(() => {
  // 各テスト前にモックをクリア
  jest.clearAllMocks();
});

afterEach(() => {
  // 各テスト後のクリーンアップ処理
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
