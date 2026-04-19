/**
 * Cronicle API client for line-accounting
 *
 * 為 APP 建立的任務 / 活動建立 Cronicle 精準排程
 * 觸發 URL 指向本 repo 的 /api/cron/push-task-reminder（發 Expo Push）
 */

function getCronicleConfig() {
  return {
    url: process.env.CRONICLE_URL,
    apiKey: process.env.CRONICLE_API_KEY,
    selfBase: process.env.LINE_ACCOUNTING_BASE_URL ?? "https://accoung.zeabur.app",
    cronSecret: process.env.CRON_SECRET,
  };
}

async function croniclePost(
  path: string,
  payload: object
): Promise<{ code: number; id?: string } | null> {
  const { url, apiKey } = getCronicleConfig();
  if (!url || !apiKey) {
    console.warn("[cronicle] CRONICLE_URL 或 CRONICLE_API_KEY 未設定，跳過排程");
    return null;
  }

  try {
    const body = JSON.stringify(payload);
    const res = await fetch(`${url}/api/app/${path}`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json; charset=utf-8",
      },
      body,
    });
    if (!res.ok) {
      console.warn(`[cronicle] ${path} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as { code: number; id?: string };
  } catch (e) {
    console.warn(`[cronicle] ${path} 失敗：`, e);
    return null;
  }
}

async function createCronicleEvent(payload: object): Promise<string | null> {
  const data = await croniclePost("create_event", payload);
  if (!data || data.code !== 0) return null;
  return data.id ?? null;
}

export async function deleteCronicleEvent(id: string): Promise<void> {
  await croniclePost("delete_event", { id });
}

/**
 * 為任務建立 Cronicle 精準提醒（觸發後自動刪除）
 */
export async function createTaskReminder(task: {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM（必填）
}): Promise<string | null> {
  const { selfBase, cronSecret } = getCronicleConfig();
  if (!cronSecret) {
    console.warn("[cronicle] CRON_SECRET 未設定");
    return null;
  }

  try {
    const [twH, twM] = task.dueTime.split(":").map(Number);
    const [y, m, d] = task.dueDate.split("-").map(Number);

    const cronId = await createCronicleEvent({
      title: `⏰ ${task.title}（${task.dueTime}）`,
      enabled: 1,
      category: "general",
      plugin: "urlplug",
      target: "allgrp",
      timezone: "Asia/Taipei",
      max_children: 1,
      timeout: 30,
      timing: {
        years: [y],
        months: [m],
        days: [d],
        hours: [twH],
        minutes: [twM],
      },
      params: {
        url: `${selfBase}/api/cron/push-task-reminder`,
        method: "POST",
        headers: `Authorization: Bearer ${cronSecret}\nContent-Type: application/json`,
        data: JSON.stringify({ taskId: task.id, cronId: "__PLACEHOLDER__" }),
        timeout: "30",
        follow: 0,
        ssl_cert_bypass: 0,
        success_match: "",
        error_match: "",
      },
    });

    // 回填 cronId 到 data（讓觸發時可自動刪除）
    if (cronId) {
      await croniclePost("update_event", {
        id: cronId,
        params: {
          url: `${selfBase}/api/cron/push-task-reminder`,
          method: "POST",
          headers: `Authorization: Bearer ${cronSecret}\nContent-Type: application/json`,
          data: JSON.stringify({ taskId: task.id, cronId }),
          timeout: "30",
          follow: 0,
          ssl_cert_bypass: 0,
          success_match: "",
          error_match: "",
        },
      });
    }

    return cronId;
  } catch (e) {
    console.warn("[cronicle] createTaskReminder 失敗：", e);
    return null;
  }
}
