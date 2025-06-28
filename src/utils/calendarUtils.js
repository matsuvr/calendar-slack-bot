/**
 * カレンダー関連のユーティリティ関数
 */

const { config } = require('../config/config');

/**
 * 予定情報からGoogleカレンダーのURLを生成する関数
 * @param {Object} event - 予定情報
 * @returns {string} - Googleカレンダー追加用のURL
 */
function createGoogleCalendarUrl(event) {
  console.log('📅 カレンダーURL生成開始:', JSON.stringify(event, null, 2));
  
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  
  if (event.title) {
    params.append('text', event.title);
  } else {
    params.append('text', '無題の予定');
  }
  
  // 場所の設定（オンライン会議URLの自動検出を含む）
  let location = event.location;
  
  // オンラインミーティングURLの抽出と場所への追加
  if (event.description) {
    // Google Meetのリンク検出
    const meetUrlMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z0-9\-]+/i);
    if (meetUrlMatch) {
      const videoUrl = meetUrlMatch[0];
      location = location ? `${location} | ${videoUrl}` : videoUrl;
    } else {
      // Zoomリンクの検出
      const zoomUrlMatch = event.description.match(/https:\/\/[^/]*zoom\.(?:us|com)\/j\/[^\s]+/i);
      if (zoomUrlMatch) {
        const videoUrl = zoomUrlMatch[0];
        location = location ? `${location} | ${videoUrl}` : videoUrl;
      }
    }
  }
  
  if (location && location !== null) {
    params.append('location', location);
  }
  
  if (event.description && event.description !== null) {
    params.append('details', event.description);
  }
  
  // 日時の設定
  if (event.date) {
    let dates = '';
    
    const startDate = event.date.replace(/-/g, '');
    
    let startTime = '';
    if (event.startTime) {
      startTime = formatTime(event.startTime);
      console.log(`📅 開始時間処理: ${event.startTime} -> ${startTime}`);
    } else {
      startTime = '000000';
      console.log('📅 開始時間が未指定、デフォルト値を使用: 000000');
    }
    
    dates += `${startDate}T${startTime}`;
    dates += '/';
    
    const endDate = event.date.replace(/-/g, '');
    
    let endTime = '';
    if (event.endTime) {
      endTime = formatTime(event.endTime);
      console.log(`📅 終了時間処理: ${event.endTime} -> ${endTime}`);
    } else {
      // 終了時間が指定されていない場合は開始時間から1時間後をデフォルトとする
      endTime = calculateEndTime(startTime);
      console.log(`📅 終了時間が未指定、計算値を使用: ${endTime}`);
    }
    
    dates += `${endDate}T${endTime}`;
    console.log(`📅 最終日時文字列: ${dates}`);
    params.append('dates', dates);
  } else {
    // 日付が指定されていない場合は今日の12:00-13:00をデフォルトとする
    const today = new Date();
    const todayFormatted = formatDateForCalendar(today);
    params.append('dates', `${todayFormatted}T120000/${todayFormatted}T130000`);
  }
  
  const finalUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
  return finalUrl;
}

/**
 * 時間形式をカレンダーURL用に整形する
 * @param {string} time - HH:MM形式の時間
 * @returns {string} - HHMMSS形式の時間
 */
function formatTime(time) {
  // HH:MM形式をHHMMSS形式に変換
  let formattedTime = time.replace(/:/g, '');
  if (formattedTime.length === 4) {
    formattedTime += '00';
  }
  return formattedTime;
}

/**
 * 開始時間から終了時間を計算する
 * @param {string} startTime - HHMMSS形式の開始時間
 * @returns {string} - HHMMSS形式の終了時間
 */
function calculateEndTime(startTime) {
  if (startTime === '000000') {
    return '235900'; // 開始時間が指定されていない場合は終日のような扱い
  }
  
  // 開始時間から1時間後を計算
  const hours = parseInt(startTime.substring(0, 2));
  const minutes = startTime.substring(2, 4);
  const seconds = startTime.substring(4, 6);
  
  const endHours = (hours + 1) % 24;
  return `${endHours.toString().padStart(2, '0')}${minutes}${seconds}`;
}

/**
 * 日付をカレンダーURL用にフォーマットする
 * @param {Date} date - 日付オブジェクト
 * @returns {string} - YYYYMMDD形式の日付文字列
 */
function formatDateForCalendar(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * SlackのURL記法を通常のURLに変換する
 * @param {string} text - 処理するテキスト
 * @returns {string} - 変換後のテキスト
 */
function removeSlackUrlMarkup(text) {
  if (!text) return text;
  return text.replace(/<(https?:\/\/[^>|]+)(?:\|[^>]+)?>/g, '$1');
}

/**
 * URL前後に全角文字がある場合、URLの前後に半角スペースを追加する
 * @param {string} text - 処理するテキスト
 * @returns {string} - 変換後のテキスト
 */
function addSpacesAroundUrls(text) {
  if (!text) return text;
  
  // より実用的で簡潔なURL正規表現（https://とhttp://のみ対応）
  const urlRegex = /https?:\/\/[^\s\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF]+/gi;
  
  return text.replace(urlRegex, (url, offset) => {
    let result = url;
    
    // URL前の文字をチェック
    if (offset > 0) {
      const prevChar = text[offset - 1];
      // 全角文字かどうかを判定（ひらがな、カタカナ、漢字、全角記号など）
      if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF]/.test(prevChar)) {
        result = ' ' + result;
      }
    }
    
    // URL後の文字をチェック
    const nextCharIndex = offset + url.length;
    if (nextCharIndex < text.length) {
      const nextChar = text[nextCharIndex];
      // 全角文字かどうかを判定
      if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF]/.test(nextChar)) {
        result = result + ' ';
      }
    }
    
    return result;
  });
}

/**
 * イベントデータを標準化・検証する
 * @param {Object} event - イベントデータ
 * @returns {Object} - 標準化されたイベントデータ
 */
function normalizeEventData(event) {
  console.log('📅 イベントデータ正規化開始:', JSON.stringify(event, null, 2));
  
  const normalizedEvent = { ...event };
  
  // 時間形式の正規化は不要（formatTime関数で処理するため）
  // Google Calendar URLにはHHMMSS形式が必要で、これはformatTime関数で変換される
  
  console.log('📅 イベントデータ正規化完了:', JSON.stringify(normalizedEvent, null, 2));
  return normalizedEvent;
}

module.exports = {
  createGoogleCalendarUrl,
  normalizeEventData,
  removeSlackUrlMarkup,
  addSpacesAroundUrls
};