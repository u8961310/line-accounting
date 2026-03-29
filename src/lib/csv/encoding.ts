import chardet from "chardet";
import iconv from "iconv-lite";

export function detectAndConvertToUtf8(buffer: Buffer): string {
  const detected = chardet.detect(buffer);
  const encoding = detected ?? "UTF-8";

  // Normalize encoding name for iconv-lite
  const normalizedEncoding = normalizeEncoding(encoding);

  if (iconv.encodingExists(normalizedEncoding)) {
    return iconv.decode(buffer, normalizedEncoding);
  }

  // Fallback to UTF-8
  return buffer.toString("utf-8");
}

function normalizeEncoding(encoding: string): string {
  const lower = encoding.toLowerCase();

  if (lower === "big5" || lower === "big5-hkscs" || lower === "windows-950") {
    return "big5";
  }

  if (lower === "utf-8" || lower === "utf8") {
    return "utf-8";
  }

  if (lower === "utf-16" || lower === "utf-16le" || lower === "utf-16be") {
    return lower;
  }

  if (lower.startsWith("windows-") || lower.startsWith("cp")) {
    return lower;
  }

  return encoding;
}
