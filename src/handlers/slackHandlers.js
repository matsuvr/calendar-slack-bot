/**
 * Slackイベント処理のハンドラー（高速化版）
 */

const { config } = require('../config/config');
const { summarizeText, extractEventsFromText, extractMeetingInfo, generateCalendarTitle } = require('../services/aiService');
const { createGoogleCalendarUrl, normalizeEventData, removeSlackUrlMarkup, addSpacesAroundUrls } = require('../utils/calendarUtils');

// グローバルな処理キュー（メモリ内重複防止）
const processingQueue = new Map();
const processedReactions = new Map(); // 処理済みリアクションのキャッシュ
const REACTION_CACHE_TTL = 300000; // 5分間キャッシュ

/**
 * 処理済みリアクションキャッシュのクリーンアップ
 */
function cleanupReactionCache() {
  const now = Date.now();
  let deleted = 0;
  
  for (const [key, timestamp] of processedReactions.entries()) {
    if (now - timestamp > REACTION_CACHE_TTL) {
      processedReactions.delete(key);
      deleted++;
    }
  }
  
  if (deleted > 0) {
    console.log(`🗑️ リアクションキャッシュクリーンアップ: ${deleted}件削除`);
  }
}

/**
 * カレンダー絵文字リアクションが追加された時の処理
 * @param {Object} event - Slackイベントオブジェクト
 * @param {Object} client - Slackクライアント
 */
async function handleCalendarReaction({ event, client }) {
  const startTime = Date.now();
  const queueKey = `${event.item.channel}-${event.item.ts}-${event.reaction}`;
  const reactionKey = `${event.item.channel}-${event.item.ts}-${event.reaction}-${event.user}`;
  
  try {
    // 🚀 超高速化: 早期リターンチェック
    if (!config.calendarReactions.includes(event.reaction) || 
        event.item.type !== 'message') {
      console.log('❌ 早期リターン: 対象外のリアクション');
      return;
    }

    // 🚀 メモリベース重複処理防止
    if (processingQueue.has(queueKey)) {
      console.log('⚡ 既に処理中のイベント:', queueKey);
      return;
    }

    // 🚀 処理済みリアクションチェック（同一ユーザーの重複防止）
    if (processedReactions.has(reactionKey)) {
      console.log('🔄 処理済みリアクション:', reactionKey);
      return;
    }

    // キャッシュクリーンアップ（10%の確率で実行）
    if (Math.random() < 0.1) {
      cleanupReactionCache();
    }

    processingQueue.set(queueKey, true);
    processedReactions.set(reactionKey, Date.now());

    console.log('✅ カレンダーリアクション検出:', event.reaction);

    // 🚀 即座に処理中表示（非同期・待機なし）
    client.reactions.add({
      channel: event.item.channel,
      timestamp: event.item.ts,
      name: 'hourglass_flowing_sand'
    }).catch(() => {}); // エラーは無視

    console.log('🔄 Slackメッセージ取得開始');

    // 🚀 Slackメッセージ取得のみ実行
    const messageResult = await client.conversations.history({
      channel: event.item.channel,
      latest: event.item.ts,
      inclusive: true,
      limit: 1
    }).catch((error) => {
      console.error('❌ Slackメッセージ取得エラー:', error.message);
      return null;
    });

    console.log('📊 メッセージ取得結果:', {
      messageExists: !!messageResult,
      messageCount: messageResult?.messages?.length || 0,
      hasText: !!messageResult?.messages?.[0]?.text
    });

    if (!messageResult) {
      console.log('🛑 メッセージ取得失敗で処理停止');
      await removeProcessingReaction(client, event.item.channel, event.item.ts);
      processingQueue.delete(queueKey);
      return;
    }

    if (!messageResult?.messages?.[0]?.text) {
      console.log('🛑 メッセージテキストが空で処理停止');
      await removeProcessingReaction(client, event.item.channel, event.item.ts);
      processingQueue.delete(queueKey);
      return;
    }

    const message = messageResult.messages[0];
    
    // 🚀 Slackマークアップを早期に除去
    let cleanedText = removeSlackUrlMarkup(message.text);
    
    // 🚀 URL前後に全角文字がある場合、半角スペースを追加
    cleanedText = addSpacesAroundUrls(cleanedText);
    
    const teamId = config.slack.teamId || 'app';
    const messageUrl = `https://${teamId}.slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;

    console.log('🚀 AI処理開始: メッセージ長', cleanedText.length, '文字');

    // 🚀 AI処理を非同期で開始（結果を待たない）
    processAIAndRespond({
      client,
      event,
      message: cleanedText, // クリーンアップ済みテキストを使用
      messageUrl,
      startTime
    }).finally(() => {
      processingQueue.delete(queueKey);
      console.log('🏁 処理キュー削除完了:', queueKey);
    });

    // 🚀 即座にリターン（AI処理の完了を待たない）
    console.log(`⏱️ 初期処理完了: ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('handleCalendarReaction エラー:', error);
    processingQueue.delete(queueKey);
    processedReactions.delete(reactionKey);
    await handleError(client, event, error);
  }
}

/**
 * AI処理と応答を非同期で実行
 */
async function processAIAndRespond({ client, event, message, messageUrl, startTime }) {
  try {
    console.log('🤖 AI処理開始: extractEventsFromText呼び出し');
    
    // 🚀 AI処理（タイムアウトを30秒に延長）
    const events = await Promise.race([
      extractEventsFromText(message),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI処理タイムアウト（30秒）')), 30000)
      )
    ]);

    console.log('✅ AI処理完了: 検出イベント数', events.length);

    // 処理中リアクション削除
    await removeProcessingReaction(client, event.item.channel, event.item.ts);

    if (events.length > 0) {
      console.log('📅 イベント処理開始: バッチ処理実行');
      // 🚀 イベント処理を非同期バッチで実行
      await processEventsInBatches({
        events,
        client,
        channelId: event.item.channel,
        messageTs: event.item.ts,
        originalText: message,
        messageUrl
      });
    } else {
      console.log('🚫 予定情報なし: 通知メッセージ送信');
      // 予定が見つからない場合
      await Promise.all([
        client.reactions.add({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: 'no_entry_sign'
        }),
        client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: '予定情報を検出できませんでした。'
        })
      ]).catch(() => {});
    }

    console.log(`⏱️ 全体処理完了: ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('AI処理エラー:', error);
    await handleError(client, event, error);
  }
}

/**
 * イベントをバッチで処理（高速化）
 */
async function processEventsInBatches({ events, client, channelId, messageTs, originalText, messageUrl }) {
  const MAX_EVENTS = config.app.maxEvents || 5;
  const BATCH_SIZE = 3; // 並列処理のバッチサイズ
  
  const processEvents = events.slice(0, MAX_EVENTS);
  
  // 制限通知（非同期・待機なし）
  if (events.length > MAX_EVENTS) {
    client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: `注意: ${events.length}件中、最初の${MAX_EVENTS}件のみ処理します。`
    }).catch(() => {});
  }

  // 🚀 会議情報を抽出
  const meetingInfo = await extractMeetingInfo(originalText);
  
  // 🚀 会議情報を考慮した要約処理
  let summary;
  if (meetingInfo) {
    // 会議情報がある場合：テキストの長さに関係なく会議情報は保持
    const textWithoutMeeting = originalText.replace(meetingInfo, '').trim();
    if (textWithoutMeeting.length > 80) {
      summary = textWithoutMeeting.substring(0, 77) + '...\n\n' + meetingInfo;
    } else {
      summary = originalText;
    }
  } else {
    // 会議情報がない場合：従来通りの処理
    summary = originalText.length > 100
      ? originalText.substring(0, 97) + '...'
      : originalText;
  }
  
  const finalDescription = `${summary}\n\nSlack投稿: ${messageUrl}`;

  // 🚀 バッチ処理でイベントを処理
  for (let i = 0; i < processEvents.length; i += BATCH_SIZE) {
    const batch = processEvents.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(async (eventItem) => {
        try {
          const normalizedEvent = normalizeEventData(eventItem);
          normalizedEvent.description = finalDescription;
          
          // 🚀 新機能: AIでタイトルを生成
          const generatedTitle = await generateCalendarTitle(originalText, eventItem);
          normalizedEvent.title = generatedTitle;
          
          const calendarUrl = createGoogleCalendarUrl(normalizedEvent);
          
          return client.chat.postMessage({
            channel: channelId,
            thread_ts: messageTs,
            text: `📅 ${normalizedEvent.title}\n${calendarUrl}`,
            unfurl_links: false // リンクのプレビューを無効化（高速化）
          });
        } catch (error) {
          console.error('イベント処理エラー:', error);
        }
      })
    );
  }
}

/**
 * 処理中リアクションを削除（エラーを無視）
 */
async function removeProcessingReaction(client, channel, timestamp) {
  try {
    await client.reactions.remove({
      channel,
      timestamp,
      name: 'hourglass_flowing_sand'
    });
  } catch (error) {
    // エラーは無視（既に削除されている可能性がある）
  }
}

/**
 * エラーハンドリング
 */
async function handleError(client, event, error) {
  try {
    let userMessage = 'エラーが発生しました';
    
    // エラーの種類に応じてユーザーフレンドリーなメッセージを設定
    if (error.message.includes('タイムアウト')) {
      userMessage = '⏰ 処理がタイムアウトしました。しばらく待ってから再度お試しください。';
    } else if (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('UNAVAILABLE')) {
      userMessage = '🚧 AI サービスが混雑しています。しばらく待ってから再度お試しください。';
    } else if (error.message.includes('401') || error.message.includes('認証')) {
      userMessage = '🔐 認証エラーが発生しました。管理者にお問い合わせください。';
    } else {
      userMessage = `❌ 処理中にエラーが発生しました: ${error.message}`;
    }

    await Promise.all([
      removeProcessingReaction(client, event.item.channel, event.item.ts),
      client.reactions.add({
        channel: event.item.channel,
        timestamp: event.item.ts,
        name: 'warning'
      }).catch(() => {}),
      client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: userMessage,
        unfurl_links: false
      })
    ]);
  } catch (postError) {
    console.error('エラーメッセージ投稿失敗:', postError);
  }
}

module.exports = {
  handleCalendarReaction
};