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
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  
  if (event.title) {
    params.append('text', event.title);
  } else {
    params.append('text', '無題の予定');
  }
  
  // descriptionの前処理
  if (event.description) {
    event.description = removeSlackUrlMarkup(event.description);
  }
  
  // オンラインミーティングURLの抽出
  let videoUrl = null;
  if (event.description) {
    // Google Meetのリンク検出
    const meetUrlMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z0-9\-]+/i);
    if (meetUrlMatch) {
      videoUrl = meetUrlMatch[0];
    } else {
      // Zoomリンクの検出
      const zoomUrlMatch = event.description.match(/https:\/\/[^/]*zoom\.(?:us|com)\/j\/[^\s]+/i);
      if (zoomUrlMatch) {
        videoUrl = zoomUrlMatch[0];
      }
    }
  }
  
  // 場所の設定（会議URLがある場合は含める）
  if (event.location && event.location !== null) {
    // 場所が指定されている場合
    let locationText = event.location;
    // 会議URLがある場合は場所に追加
    if (videoUrl) {
      locationText += ` (${videoUrl})`;
    }
    params.append('location', locationText);
  } else if (videoUrl) {
    // 場所は指定されていないが会議URLがある場合
    params.append('location', videoUrl);
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
    } else {
      startTime = '000000';
    }
    
    dates += `${startDate}T${startTime}`;
    dates += '/';
    
    const endDate = event.date.replace(/-/g, '');
    
    let endTime = '';
    if (event.endTime) {
      endTime = formatTime(event.endTime);
    } else {
      // 終了時間が指定されていない場合は開始時間から1時間後をデフォルトとする
      endTime = calculateEndTime(startTime);
    }
    
    dates += `${endDate}T${endTime}`;
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
 * イベントデータを標準化・検証する
 * @param {Object} event - イベントデータ
 * @returns {Object} - 標準化されたイベントデータ
 */
function normalizeEventData(event) {
  const normalizedEvent = { ...event };
  
  // 時間形式の標準化 (HH:MM -> HH:MM:00)
  if (normalizedEvent.startTime && !normalizedEvent.startTime.includes(':00')) {
    normalizedEvent.startTime = normalizedEvent.startTime + ':00';
  }

  if (normalizedEvent.endTime && !normalizedEvent.endTime.includes(':00')) {
    normalizedEvent.endTime = normalizedEvent.endTime + ':00';
  }
  
  return normalizedEvent;
}

module.exports = {
  createGoogleCalendarUrl,
  normalizeEventData
};