/**
 * Firestoreサービスのモック
 * テスト用のFirestore操作を模擬
 */

class MockFirestoreService {
  constructor() {
    this.storage = new Map(); // メモリ内ストレージ
  }

  async checkDuplicateRequest(messageId) {
    return this.storage.has(messageId);
  }

  async recordProcessedMessage(messageId, eventData) {
    this.storage.set(messageId, {
      messageId,
      eventData,
      processedAt: new Date().toISOString()
    });
    return true;
  }

  async getProcessedMessage(messageId) {
    return this.storage.get(messageId) || null;
  }

  // テスト用のユーティリティメソッド
  clear() {
    this.storage.clear();
  }

  size() {
    return this.storage.size;
  }

  // エラーシミュレーション
  simulateConnectionError() {
    throw new Error('Firestore connection failed');
  }
}

module.exports = { MockFirestoreService };
