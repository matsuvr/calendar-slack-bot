/**
 * AIサービスのモック
 * テスト用のGemini APIレスポンスを模擬
 */

class MockAiService {
  constructor() {
    this.mockResponses = {
      extractEvents: [
        {
          title: 'テストミーティング',
          startDate: '2025-06-23',
          startTime: '14:00',
          endDate: '2025-06-23',
          endTime: '15:00',
          location: '会議室A',
          description: 'プロジェクトの進捗確認'
        }
      ]
    };
  }
  async extractEventsFromMessage(message) {
    // テスト用のレスポンスを返す
    if (message.includes('エラー')) {
      throw new Error('Test API Error');
    }
    
    // より緩い条件でイベントを検出
    if (message.includes('予定') || message.includes('MTG') || message.includes('ミーティング') || message.includes('会議')) {
      return this.mockResponses.extractEvents;
    }
    
    return [];
  }

  // テスト用のレスポンス設定メソッド
  setMockResponse(key, response) {
    this.mockResponses[key] = response;
  }

  // エラーレスポンスのシミュレーション
  simulateApiError() {
    throw new Error('Gemini API rate limit exceeded');
  }
}

module.exports = { MockAiService };
