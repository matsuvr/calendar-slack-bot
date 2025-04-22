/**
 * Firestoreデータベース操作のためのサービスモジュール
 */

const { Firestore } = require('@google-cloud/firestore');
const { config } = require('../config/config');

// Firestoreの初期化
const firestore = new Firestore();
const processedReactionsCollection = firestore.collection('processedReactions');

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
  
  try {
    if (!config.firestore.readonly) {
      const result = await firestore.runTransaction(async (transaction) => {
        const docRef = processedReactionsCollection.doc(reactionKey);
        const docSnapshot = await transaction.get(docRef);
        
        if (docSnapshot.exists) {
          return { alreadyProcessed: true };
        }
        
        transaction.set(docRef, { 
          processed: true,
          channel: channelId,
          timestamp: timestamp,
          reaction: reaction,
          user: userId,
          processedAt: new Date()
        });
        
        return { alreadyProcessed: false };
      });
      
      return !result.alreadyProcessed;
    } else {
      // 読み取り専用モードの場合
      const firestoreDoc = await processedReactionsCollection.doc(reactionKey).get();
      return !firestoreDoc.exists;
    }
  } catch (error) {
    console.error('Firestore操作でエラー:', error);
    // エラーが発生しても処理を継続
    return true;
  }
}

module.exports = {
  checkAndMarkReactionAsProcessed
};