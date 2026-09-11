import { createAuthClient } from "better-auth/react";

/**
 * ブラウザからの認証操作。Discord のログイン開始とログアウトだけに使う。
 * ベース URL は配信中のオリジン（本番は cho.nikomaru.dev、開発は localhost）。
 */
export const authClient = createAuthClient();
