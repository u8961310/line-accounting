/**
 * MCP HTTP endpoint（Streamable HTTP transport）
 * 讓任何支援 MCP 的 AI 工具透過 HTTP 連線到本記帳系統
 *
 * 驗證：Header  x-api-key: <INTERNAL_API_KEY>
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/createMcpServer";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function checkAuth(req: Request): boolean {
  const key = req.headers.get("x-api-key");
  return key === process.env.INTERNAL_API_KEY && !!key;
}

async function handle(req: Request): Promise<Response> {
  if (!checkAuth(req)) return unauthorized();

  const mcpServer = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });

  await mcpServer.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
