import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/app-version
 * 回傳最新 kogao-app APK 的版本與下載網址。
 * kogao-app 啟動時打這支，檢查是否有新版本可下載。
 *
 * 驗證：middleware INTERNAL_API_KEY
 *
 * 資料來源：環境變數（每次 build 完新 APK 就更新）
 * - LATEST_APK_VERSION：例如 "1.0.2"
 * - LATEST_APK_URL：例如 "https://expo.dev/artifacts/eas/xxx.apk"
 * - LATEST_APK_NOTES：選填，新版更新說明
 * - LATEST_APK_PLATFORM：選填，"android" | "ios" | "all"（預設 all）
 */
export async function GET(): Promise<NextResponse> {
  const latest = process.env.LATEST_APK_VERSION ?? "1.0.0";
  const downloadUrl = process.env.LATEST_APK_URL ?? "";
  const releaseNotes = process.env.LATEST_APK_NOTES ?? "";
  const platform = process.env.LATEST_APK_PLATFORM ?? "all";

  return NextResponse.json({
    latest,
    downloadUrl,
    releaseNotes,
    platform,
  });
}
