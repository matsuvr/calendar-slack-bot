# テスト駆動開発（TDD）ガイド

このドキュメントでは、calendar-slack-botプロジェクトでのテスト駆動開発（TDD）の実践方法を説明します。

## 📚 TDDとは

テスト駆動開発（Test-Driven Development）は、以下のサイクルを繰り返す開発手法です：

### 🔴 Red（レッド段階）
1. **失敗するテストを書く**
   - まず要求される機能のテストを書く
   - この時点ではコードが存在しないため、テストは失敗する

### 🟢 Green（グリーン段階）
2. **テストを通す最小限のコードを書く**
   - テストが通るように、最小限の実装を行う
   - 品質よりもテストが通ることを優先

### 🔵 Refactor（リファクタリング段階）
3. **コードを改善する**
   - テストが通った状態で、コードの品質を向上させる
   - テストが継続して通ることを確認しながら改善

## 🚀 プロジェクトでのTDD実践

### 1. 環境セットアップ

```bash
# テスト用パッケージのインストール
npm install --save-dev jest supertest @jest/globals

# テスト実行
npm test

# ウォッチモードでテスト実行（変更時に自動実行）
npm run test:watch

# カバレッジ付きでテスト実行
npm run test:coverage
```

### 2. テストファイルの構成

```
tests/
├── setup.js           # テスト共通設定
├── unit/              # ユニットテスト
│   ├── calendarUtils.test.js
│   ├── aiService.test.js
│   └── config.test.js
├── integration/       # 統合テスト
│   ├── api.test.js
│   └── slack.test.js
└── mocks/            # モック/スタブ
    └── aiService.mock.js

**注意**: firestoreService.mock.jsは使用されません（メモリ内キャッシュを使用）。
```

### 3. TDDサイクルの実例

#### 例：カレンダーURL生成機能

##### 🔴 Red段階: テストを先に書く

```javascript
// tests/unit/calendarUtils.test.js
describe('createGoogleCalendarUrl', () => {
  test('should generate URL from basic event info', () => {
    const event = {
      title: 'テストミーティング',
      startDate: '2025-06-23',
      startTime: '14:00',
      location: '会議室A'
    };

    const url = createGoogleCalendarUrl(event);

    expect(url).toContain('calendar.google.com');
    expect(decodeURIComponent(url)).toContain('text=テストミーティング');
  });
});
```

この時点で `npm test` を実行すると、関数が存在しないため**テストは失敗**します。

##### 🟢 Green段階: 最小限の実装

```javascript
// src/utils/calendarUtils.js
function createGoogleCalendarUrl(event) {
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  
  if (event.title) {
    params.append('text', event.title);
  }
  
  return `${baseUrl}&${params.toString()}`;
}

module.exports = { createGoogleCalendarUrl };
```

この実装で `npm test` を実行すると、**テストが通ります**。

##### 🔵 Refactor段階: コードの改善

テストが通った状態で、コードの品質を向上させます：

```javascript
function createGoogleCalendarUrl(event) {
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  
  // タイトルの設定（デフォルト値対応）
  params.append('text', event.title || '無題の予定');
  
  // 場所の設定
  if (event.location && event.location !== null) {
    params.append('location', event.location);
  }
  
  // 日時の設定
  if (event.startDate && event.startTime) {
    const startDateTime = formatDateTime(event.startDate, event.startTime);
    const endDateTime = formatDateTime(event.endDate || event.startDate, event.endTime || event.startTime);
    params.append('dates', `${startDateTime}/${endDateTime}`);
  }
  
  return `${baseUrl}&${params.toString()}`;
}
```

#### 例：AIタイトル生成機能のテスト

##### 🔴 Red段階: テストを先に書く

```javascript
// tests/unit/aiService.test.js
describe('generateCalendarTitle', () => {
  test('should generate concise title from event data', async () => {
    const originalText = '明日13時から14時まで会議室Aでプロジェクト進捗MTG';
    const eventData = {
      title: 'プロジェクト進捗MTG',
      startDate: '2025-06-26',
      startTime: '13:00',
      location: '会議室A'
    };

    const title = await generateCalendarTitle(originalText, eventData);

    expect(title).toBeDefined();
    expect(title.length).toBeLessThanOrEqual(30);
    expect(title).toContain('MTG');
  });

  test('should handle AI failure gracefully', async () => {
    const originalText = 'テスト';
    const eventData = { title: 'フォールバックタイトル' };

    const title = await generateCalendarTitle(originalText, eventData);

    expect(title).toBe('フォールバックタイトル'); // フォールバック処理
  });
});
```

#### 例：テキスト前処理機能のテスト

##### 🔴 Red段階: テストを先に書く

```javascript
// tests/unit/calendarUtils.test.js
describe('addSpacesAroundUrls', () => {
  test('should add spaces around URLs adjacent to full-width characters', () => {
    const text = 'ミーティングhttps://zoom.us/j/123です';
    
    const result = addSpacesAroundUrls(text);
    
    expect(result).toBe('ミーティング https://zoom.us/j/123 です');
  });

  test('should not modify URLs already with spaces', () => {
    const text = 'ミーティング https://zoom.us/j/123 です';
    
    const result = addSpacesAroundUrls(text);
    
    expect(result).toBe('ミーティング https://zoom.us/j/123 です');
  });
});

describe('removeSlackUrlMarkup', () => {
  test('should remove Slack URL markup', () => {
    const text = 'リンク: <https://example.com|サンプル>';
    
    const result = removeSlackUrlMarkup(text);
    
    expect(result).toBe('リンク: https://example.com');
  });
});
```

#### 例：メモリ内キャッシュのテスト

##### 🔴 Red段階: テストを先に書く

```javascript
// tests/unit/memoryCache.test.js
describe('Memory Cache', () => {
  test('should prevent duplicate processing', () => {
    const processingQueue = new Map();
    const queueKey = 'channel-123-timestamp-456-calendar';
    
    // 初回は処理される
    expect(processingQueue.has(queueKey)).toBe(false);
    processingQueue.set(queueKey, true);
    
    // 2回目は重複として検出される
    expect(processingQueue.has(queueKey)).toBe(true);
  });

  test('should clean up expired cache entries', () => {
    const processedReactions = new Map();
    const CACHE_TTL = 300000; // 5分
    const now = Date.now();
    
    // 期限切れのエントリを追加
    processedReactions.set('old-key', now - CACHE_TTL - 1000);
    // 有効なエントリを追加
    processedReactions.set('new-key', now);
    
    // クリーンアップ実行
    for (const [key, timestamp] of processedReactions.entries()) {
      if (now - timestamp > CACHE_TTL) {
        processedReactions.delete(key);
      }
    }
    
    expect(processedReactions.has('old-key')).toBe(false);
    expect(processedReactions.has('new-key')).toBe(true);
  });
});
```

## 🔧 テストのベストプラクティス

### 1. テストの命名規則

```javascript
// ❌ 悪い例
test('test1', () => { /* ... */ });

// ✅ 良い例
test('should generate URL when title is provided', () => { /* ... */ });
test('should use default title when title is empty', () => { /* ... */ });
test('should handle null values gracefully', () => { /* ... */ });
```

### 2. AAA（Arrange-Act-Assert）パターン

```javascript
test('should generate URL from basic event info', () => {
  // Arrange（準備）: テストデータの設定
  const event = {
    title: 'テストミーティング',
    startDate: '2025-06-23',
    startTime: '14:00'
  };

  // Act（実行）: テスト対象の関数を実行
  const url = createGoogleCalendarUrl(event);

  // Assert（検証）: 結果の確認
  expect(url).toContain('calendar.google.com');
  expect(decodeURIComponent(url)).toContain('text=テストミーティング');
});
```

### 3. モックの活用

外部APIやデータベースをモックで置き換えてテストを高速化：

```javascript
// tests/mocks/aiService.mock.js
class MockAiService {
  async extractEventsFromMessage(message) {
    if (message.includes('会議')) {
      return [{
        title: 'テスト会議',
        startDate: '2025-06-23',
        startTime: '14:00'
      }];
    }
    return [];
  }
}
```

## 🎯 テスト実行コマンド

```bash
# 全テスト実行
npm test

# 特定のテストファイル実行
npm test -- tests/unit/calendarUtils.test.js

# テスト名でフィルタ
npm test -- --testNamePattern="should generate URL"

# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage

# デバッグモード
npm run test:debug
```

## 📊 カバレッジ目標

プロジェクトでは以下のカバレッジ目標を設定しています：

- **Lines（行カバレッジ）**: 70%以上
- **Functions（関数カバレッジ）**: 70%以上
- **Branches（分岐カバレッジ）**: 70%以上
- **Statements（文カバレッジ）**: 70%以上

## 🐛 デバッグとトラブルシューティング

### よくある問題と解決法

#### 1. テストが認識されない
```bash
# Jest設定を確認
npx jest --showConfig

# テストファイルパターンを確認
npx jest --listTests
```

#### 2. モックが効かない
```javascript
// モックの設定タイミングを確認
jest.mock('../../src/services/aiService', () => ({
  extractEventsFromMessage: jest.fn()
}));
```

#### 3. 非同期テストの問題
```javascript
// async/awaitを使用
test('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## 🚀 継続的インテグレーション

### GitHub Actionsでの自動テスト

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## 📈 TDDの利点

1. **品質向上**: バグの早期発見
2. **設計改善**: テスタブルなコード構造
3. **リファクタリング安全性**: テストがセーフティネット
4. **仕様の明確化**: テストが仕様書の役割
5. **開発効率**: デバッグ時間の短縮

## 📝 次のステップ

1. **エッジケースのテスト追加**
   - 無効な入力値のテスト
   - 境界値テスト
   - エラーハンドリングテスト

2. **パフォーマンステスト**
   - 大量データでの動作確認
   - メモリ使用量の監視
   - キャッシュ効率の検証

3. **AI機能のテスト**
   - Gemini APIレスポンスのモック
   - タイトル生成のバリエーションテスト
   - フォールバック処理のテスト

4. **メモリキャッシュのテスト**
   - TTL機能の動作確認
   - 並行処理での競合状態テスト
   - メモリリーク検証

5. **E2Eテスト**
   - 実際のSlackイベントでのテスト
   - ブラウザでのGoogleカレンダー連携テスト

6. **継続的な改善**
   - カバレッジの向上
   - テスト実行時間の最適化
   - テストの保守性向上

---

このガイドを参考に、TDDを実践して高品質なソフトウェア開発を進めましょう！
