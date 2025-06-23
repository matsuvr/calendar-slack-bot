/**
 * AIサービスのユニットテスト
 * モックを使用したTDDの実例
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');
const { MockAiService } = require('../mocks/aiService.mock');

// 実際のAIサービスをモックに置き換え
jest.mock('../../src/services/aiService', () => {
  const { MockAiService } = require('../mocks/aiService.mock');
  return {
    extractEventsFromMessage: async (message) => {
      const mockService = new MockAiService();
      return mockService.extractEventsFromMessage(message);
    }
  };
});

describe('AI Service Tests', () => {
  let mockAiService;

  beforeEach(() => {
    mockAiService = new MockAiService();
  });

  describe('extractEventsFromMessage', () => {
    test('should extract event from valid message', async () => {
      const message = '明日14時から15時まで会議室Aでプロジェクト進捗MTGがあります';
      
      const events = await mockAiService.extractEventsFromMessage(message);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        title: 'テストミーティング',
        startDate: '2025-06-23',
        startTime: '14:00',
        location: '会議室A'
      });
    });

    test('should return empty array for messages without events', async () => {
      const message = 'こんにちは、元気ですか？';
      
      const events = await mockAiService.extractEventsFromMessage(message);
      
      expect(events).toHaveLength(0);
    });

    test('should handle API errors gracefully', async () => {
      const message = 'エラーを発生させるメッセージ';
      
      await expect(
        mockAiService.extractEventsFromMessage(message)
      ).rejects.toThrow('Test API Error');
    });

    test('should validate extracted event structure', async () => {
      const message = '予定があります';
      
      const events = await mockAiService.extractEventsFromMessage(message);
      
      expect(events[0]).toHaveProperty('title');
      expect(events[0]).toHaveProperty('startDate');
      expect(events[0]).toHaveProperty('startTime');
      expect(events[0]).toHaveProperty('location');
      expect(events[0]).toHaveProperty('description');
    });
  });

  describe('Mock Customization', () => {
    test('should allow custom mock responses', async () => {
      const customEvent = {
        title: 'カスタムイベント',
        startDate: '2025-12-25',
        startTime: '09:00'
      };
      
      mockAiService.setMockResponse('extractEvents', [customEvent]);
      
      const events = await mockAiService.extractEventsFromMessage('予定');
      
      expect(events[0].title).toBe('カスタムイベント');
      expect(events[0].startDate).toBe('2025-12-25');
    });
  });
});
