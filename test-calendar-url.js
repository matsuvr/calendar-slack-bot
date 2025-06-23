/**
 * カレンダーURL生成のテストスクリプト
 */

const { createGoogleCalendarUrl } = require('./src/utils/calendarUtils');

console.log('=== カレンダーURL生成テスト ===\n');

// テストケース1: 基本的な予定（添付画像のデータ）
const testEvent1 = {
  title: 'デザインチームとのミーティング',
  location: null, // 場所なし
  description: '16時からデザインチームとリモート会議（URL: https://meet.google.com/abc-defg-hij）。新プロジェクトのデザイン案を確認します。',
  date: '2025-06-23',
  startTime: '16:00',
  endTime: '17:00'
};

// テストケース2: 場所ありの予定
const testEvent2 = {
  title: 'デザインチームとのミーティング',
  location: '会議室A',
  description: '16時からデザインチームとリモート会議（URL: https://meet.google.com/abc-defg-hij）。新プロジェクトのデザイン案を確認します。',
  date: '2025-06-23',
  startTime: '16:00',
  endTime: '17:00'
};

console.log('テストケース1: 場所なし + Google Meet URL');
const url1 = createGoogleCalendarUrl(testEvent1);
console.log('Generated URL:', url1);
console.log('Decoded URL:', decodeURIComponent(url1));
console.log('✓ addパラメータが含まれていない:', !url1.includes('add=conference-'));
console.log('✓ locationにMeet URLが含まれている:', decodeURIComponent(url1).includes('location=https://meet.google.com/abc-defg-hij'));
console.log('');

console.log('テストケース2: 会議室A + Google Meet URL');
const url2 = createGoogleCalendarUrl(testEvent2);
console.log('Generated URL:', url2);
console.log('Decoded URL:', decodeURIComponent(url2));
console.log('✓ addパラメータが含まれていない:', !url2.includes('add=conference-'));
console.log('✓ locationに会議室AとMeet URLが含まれている:', decodeURIComponent(url2).includes('会議室A') && decodeURIComponent(url2).includes('https://meet.google.com/abc-defg-hij'));
console.log('');

console.log('=== テスト完了 ===');
