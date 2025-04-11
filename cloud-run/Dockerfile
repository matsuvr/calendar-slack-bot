# Node.jsイメージを使用（package.jsonの要件に合わせて20に更新）
FROM node:20-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# Dockerコンテナ内のポートを公開
EXPOSE 8080

# .envファイルがない場合のデフォルト値を設定
ENV PORT=8080
ENV NODE_ENV=production

# デバッグ情報の追加
RUN echo '#!/bin/bash \n\
echo "環境変数の確認:" \n\
echo "PORT=$PORT" \n\
echo "NODE_ENV=$NODE_ENV" \n\
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_SIGNING_SECRET" ] || [ -z "$GEMINI_API_KEY" ]; then \n\
  echo "警告: 必須環境変数が設定されていません。以下の環境変数を設定してください: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, GEMINI_API_KEY" \n\
  echo "環境変数が設定されていないため、アプリケーションは正常に動作しない可能性があります。" \n\
else \n\
  echo "必須環境変数が正常に設定されています。" \n\
fi \n\
echo "ファイル一覧:" \n\
ls -la \n\
echo "server.jsの権限:" \n\
ls -la server.js \n\
echo "起動コマンド: node server.js" \n\
exec "$@"' > /usr/local/bin/entrypoint.sh \
&& chmod +x /usr/local/bin/entrypoint.sh

# アプリケーションを起動
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]