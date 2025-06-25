# Node.jsイメージを使用（安定版のLTSに更新）
FROM node:20-slim

# セキュリティアップデートを適用（Debian/Ubuntu系のパッケージ管理に変更）
RUN apt-get update && apt-get upgrade -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（プロダクション用の最適化）
RUN npm ci --omit=dev && npm cache clean --force

# アプリケーションのソースコードをコピー
COPY . .

# Dockerコンテナ内のポートを公開
EXPOSE 8080

# .envファイルがない場合のデフォルト値を設定
ENV PORT=8080
ENV NODE_ENV=production
ENV FIRESTORE_TIMEOUT_MS=6000
ENV NODE_OPTIONS="--max-http-header-size=16384"

# デバッグ情報用の簡易スクリプトを作成
RUN echo '#!/bin/bash' > /usr/local/bin/entrypoint.sh && \
    echo 'echo "コンテナ起動: ポート=$PORT"' >> /usr/local/bin/entrypoint.sh && \
    echo 'exec "$@"' >> /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

# アプリケーションを起動
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]