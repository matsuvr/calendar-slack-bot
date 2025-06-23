module.exports = {
  // テスト環境の設定
  testEnvironment: 'node',
  
  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // テスト実行前のセットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
  ],
  
  // カバレッジレポートの形式
  coverageReporters: ['text', 'lcov', 'html'],
  
  // カバレッジしきい値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // モック設定
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // テストタイムアウト
  testTimeout: 10000,
  
  // 詳細表示
  verbose: true,
  
  // トランスフォーム設定
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
    // 非同期操作の処理
  forceExit: true,
  detectOpenHandles: true,
  
  // テストファイルのタイムアウト設定
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
