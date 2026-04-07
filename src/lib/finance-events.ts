/**
 * 跨元件財務資料變動通知
 *
 * 任何元件存檔後呼叫 notifyFinanceChanged()，
 * 需要同步的元件用 useFinanceChanged(callback) 監聽。
 */
import { useEffect } from "react";

const EVENT_NAME = "finance-data-changed";

export function notifyFinanceChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function useFinanceChanged(callback: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT_NAME, callback);
    return () => window.removeEventListener(EVENT_NAME, callback);
  }, [callback]);
}
