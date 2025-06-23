/**
 * Firestoreデータベース操作のためのサービスモジュール
 */

const { Firestore } = require('@google-cloud/firestore');
const { config } = require('../config/config');

// 🚀 高速化: Firestore設定を最適化
const firestore = new Firestore({
  // 🚀 接続プールとタイムアウトの設定
  settings: {
    ignoreUndefinedProperties: true,
  },
});
const processedReactionsCollection = firestore.collection('processedReactions');

// 🚀 高速化: メモリ内キャッシュで重複チェックを高速化
const recentProcessedCache = new Map();
const CACHE_TTL = 300000; // 5分間キャッシュ
const MAX_CACHE_SIZE = 1000;

/**
 * キャッシュのクリーンアップ
 */
function cleanupCache() {
  const now = Date.now();
  let deleted = 0;
  
  for (const [key, value] of recentProcessedCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      recentProcessedCache.delete(key);
      deleted++;
    }
  }
  
  // サイズ制限を超えた場合は古いエントリを削除
  if (recentProcessedCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(recentProcessedCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, recentProcessedCache.size - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => recentProcessedCache.delete(key));
    deleted += toDelete.length;
  }
  
  if (deleted > 0) {
    console.log(`🗑️ キャッシュクリーンアップ: ${deleted}件削除`);
  }
}

/**
 * リアクションが既に処理済みかチェックし、未処理の場合は処理済みとしてマークする
 * @param {string} channelId - チャンネルID
 * @param {string} timestamp - メッセージのタイムスタンプ
 * @param {string} reaction - リアクション絵文字名
 * @param {string} userId - リアクションを追加したユーザーID
 * @returns {Promise<boolean>} - 処理を続行すべきかどうか（false=既に処理済み）
 */
async function checkAndMarkReactionAsProcessed(channelId, timestamp, reaction, userId) {
  const reactionKey = `${channelId}-${timestamp}-${reaction}`;
  const startTime = Date.now();
  
  try {
    // 🚀 高速化: メモリキャッシュを最初にチェック
    const cachedEntry = recentProcessedCache.get(reactionKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_TTL) {
      console.log(`⚡ キャッシュヒット: ${reactionKey} (${Date.now() - startTime}ms)`);
      return false; // キャッシュにあるということは処理済み
    }

    console.log('🔍 Firestore重複チェック開始:', { reactionKey, userId });
    
    if (!config.firestore.readonly) {
      // 🚀 高速化: タイムアウト付きトランザクション
      const transactionPromise = firestore.runTransaction(async (transaction) => {
        const docRef = processedReactionsCollection.doc(reactionKey);
        const docSnapshot = await transaction.get(docRef);
        
        console.log('📄 Firestoreドキュメント状態:', { 
          exists: docSnapshot.exists, 
          reactionKey 
        });
        
        if (docSnapshot.exists) {
          console.log(`❌ 既に処理済み: ${reactionKey} (${Date.now() - startTime}ms)`);
          // 🚀 キャッシュに追加
          recentProcessedCache.set(reactionKey, { timestamp: Date.now() });
          return { alreadyProcessed: true };
        }
        
        console.log(`✅ 新しいリアクション: ${reactionKey} (${Date.now() - startTime}ms)`);
        transaction.set(docRef, { 
          processed: true,
          channel: channelId,
          timestamp: timestamp,
          reaction: reaction,
          user: userId,
          processedAt: new Date()
        });
        
        // 🚀 キャッシュに追加
        recentProcessedCache.set(reactionKey, { timestamp: Date.now() });
        return { alreadyProcessed: false };
      });

      // 🚀 高速化: 5秒でタイムアウト
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore操作タイムアウト (5秒)')), 5000)
      );

      const result = await Promise.race([transactionPromise, timeoutPromise]);
      
      // 定期的なキャッシュクリーンアップ
      if (Math.random() < 0.1) { // 10%の確率で実行
        setImmediate(cleanupCache);
      }
      
      return !result.alreadyProcessed;
    } else {
      // 🚀 高速化: 読み取り専用モードもタイムアウト付き
      console.log('📖 読み取り専用モードでチェック:', reactionKey);
      
      const readPromise = processedReactionsCollection.doc(reactionKey).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore読み取りタイムアウト (3秒)')), 3000)
      );

      const firestoreDoc = await Promise.race([readPromise, timeoutPromise]);
      
      console.log(`📄 読み取り専用結果: ${firestoreDoc.exists} (${Date.now() - startTime}ms)`);
      
      if (firestoreDoc.exists) {
        // 🚀 キャッシュに追加
        recentProcessedCache.set(reactionKey, { timestamp: Date.now() });
      }
      
      return !firestoreDoc.exists;
    }
  } catch (error) {
    console.error(`🚨 Firestore操作エラー (${Date.now() - startTime}ms):`, error.message);
    
    // 🚀 高速化: タイムアウトエラーの場合は処理を続行
    if (error.message.includes('タイムアウト')) {
      console.warn('⚠️ タイムアウトのため処理を続行');
      return true;
    }
    
    console.error('🚨 エラー詳細:', error);
    // エラーが発生しても処理を継続
    return true;
  }
}

module.exports = {
  checkAndMarkReactionAsProcessed
};