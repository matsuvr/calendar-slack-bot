/**
 * カレンダーユーティリティのユニットテスト
 * TDD（テスト駆動開発）の実践例
 */

const { describe, test, expect } = require('@jest/globals');
const { createGoogleCalendarUrl } = require('../../src/utils/calendarUtils');

describe('calendarUtils', () => {
  
  describe('createGoogleCalendarUrl', () => {
    test('基本的な予定情報からURLを生成できる', () => {
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

    test('タイトルが空の場合はデフォルトタイトルを使用する', () => {
      const event = {
        startDate: '2025-06-23',
        startTime: '14:00'
      };

      const url = createGoogleCalendarUrl(event);

      expect(decodeURIComponent(url)).toContain('text=無題の予定');
    });    test('Google Meetリンクが含まれる場合は場所情報に追加する', () => {
      const event = {
        title: 'オンラインミーティング',
        description: 'Google Meetで開催します https://meet.google.com/abc-defg-hij',
        date: '2025-06-24',
        startTime: '12:00'
      };

      const url = createGoogleCalendarUrl(event);

      // 会議URLが場所に含まれることを確認
      expect(decodeURIComponent(url)).toContain('location=https://meet.google.com/abc-defg-hij');
      // addパラメータに会議情報が含まれないことを確認
      expect(decodeURIComponent(url)).not.toContain('add=conference-');
    });

    test('場所とGoogle Meetリンクの両方がある場合は併記する', () => {
      const event = {
        title: 'ハイブリッドミーティング',
        location: '会議室A',
        description: 'Google Meetでも参加可能 https://meet.google.com/abc-defg-hij',
        date: '2025-06-24',
        startTime: '12:00'
      };

      const url = createGoogleCalendarUrl(event);      // 場所と会議URLが併記されることを確認（デコードして確認）
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain('会議室A');
      expect(decodedUrl).toContain('https://meet.google.com/abc-defg-hij');
      expect(decodedUrl).toContain('location=');
    });

    test('nullやundefinedの値を適切に処理する', () => {
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
