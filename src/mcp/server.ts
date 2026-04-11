#!/usr/bin/env node
/**
 * LINE 記帳系統 MCP Server（stdio 模式）
 * 讓 Claude Desktop / Claude Code 可以直接查詢記帳資料。
 *
 * 啟動：npx tsx src/mcp/server.ts
 *
 * 實際邏輯在 createMcpServer.ts（HTTP 模式的 /api/mcp 也共用同一份），
 * 本檔只負責 stdio transport 包裝。
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./createMcpServer";

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE 記帳 MCP Server 啟動中...");
}

main().catch(console.error);
