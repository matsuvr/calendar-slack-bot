/**
 * カレンダーユーティリティのユニットテスト
 * TDD（テスト駆動開発）の実践例
 */

const { describe, test, expect } = require('@jest/globals');
const { createGoogleCalendarUrl } = require('../../src/utils/calendarUtils');

describe('calendarUtils', () => {
  
  describe('createGoogleCalendarUrl', () => {
    test('should generate URL from basic event info', () => {
      // Arrange（準備）
      const event = {
        title: 'テストミーティング',
        startDate: '2025-06-23',
        startTime: '14:00',
        endDate: '2025-06-23',
        endTime: '15:00',
        location: '会議室A',
        description: 'プロジェクトの進捗確認'
      };

      // Act（実行）
      const url = createGoogleCalendarUrl(event);

      // Assert（検証）
      expect(url).toContain('calendar.google.com');
      expect(decodeURIComponent(url)).toContain('text=テストミーティング');
      expect(decodeURIComponent(url)).toContain('location=会議室A');
      expect(decodeURIComponent(url)).toContain('details=プロジェクトの進捗確認');
    });

    test('should use default title when title is empty', () => {
      const event = {
        startDate: '2025-06-23',
        startTime: '14:00'
      };

      const url = createGoogleCalendarUrl(event);

      expect(decodeURIComponent(url)).toContain('text=無題の予定');
    });    test('should add conference info for Google Meet links', () => {
      const event = {
        title: 'オンラインミーティング',
        description: 'Google Meetで開催します https://meet.google.com/abc-defg-hij',
        startDate: '2025-06-23',
        startTime: '14:00'
      };

      const url = createGoogleCalendarUrl(event);

      // Google MeetのURLがlocationパラメータに含まれることを確認
      expect(decodeURIComponent(url)).toContain('location=https://meet.google.com/abc-defg-hij');
    });

    test('should handle null and undefined values properly', () => {
      const event = {
        title: null,
        location: null,
        description: null,
        startDate: '2025-06-23',
        startTime: '14:00'
      };

      const url = createGoogleCalendarUrl(event);

      expect(decodeURIComponent(url)).toContain('text=無題の予定');
      expect(url).not.toContain('location=null');
      expect(url).not.toContain('details=null');
    });
  });
});
