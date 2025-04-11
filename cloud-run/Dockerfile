# Node.jsイメージを使用（package.jsonの要件に合わせて20に更新）
FROM node:22-slim

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

# 必須環境変数のチェック用スクリプトを作成
RUN echo '#!/bin/bash \n\
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_SIGNING_SECRET" ] || [ -z "$GEMINI_API_KEY" ]; then \n\
  echo "必須環境変数が設定されていません。以下の環境変数を設定してください: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, GEMINI_API_KEY" \n\
  exit 1 \n\
fi \n\
exec "$@"' > /usr/local/bin/entrypoint.sh \
&& chmod +x /usr/local/bin/entrypoint.sh

# アプリケーションを起動
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]