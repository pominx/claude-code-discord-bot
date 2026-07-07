# 升級至 Claude Code CLI 2.1.202 呼叫方式

## 待辦

- [x] 重現錯誤：`MCP tool mcp__discord-permissions__approve_tool not found. Available MCP tools: none`
- [x] 找出 root cause（mcp-bridge.cjs 與 2.x 的 stdio 訊息批次寫入不相容）
- [x] 改用 Claude Code 2.x 原生 HTTP MCP config（`type: "http"` + headers 傳 Discord context）
- [x] 移除 mcp-bridge.cjs 與 temp config 檔案機制
- [x] 更新 shell.test.ts（TDD：先改測試再改實作）
- [x] 修復 manager.test.ts 過時測試（channelResponses → channelToolCalls）
- [x] .env.example 補上 MCP_SERVER_PORT / MCP_APPROVAL_TIMEOUT / MCP_DEFAULT_ON_TIMEOUT
- [x] 端對端驗證：以 claude 2.1.202 實測 buildClaudeCommand 輸出的指令

## Review

### Root cause

Claude Code 2.x 會把多個換行分隔的 JSON-RPC 訊息（如 `notifications/initialized` + `tools/list`）
在同一個 stdin chunk 寫給 MCP stdio server。舊的 `mcp-bridge.cjs` 假設「一個 chunk = 一個完整
JSON 訊息」，把整個 chunk 當成單一 HTTP body 轉發，導致 express JSON parser 解析失敗
（`Unexpected non-whitespace character after JSON ... line 2 column 1`），MCP 握手永遠停在
`pending`，因此 `--permission-prompt-tool` 找不到工具、程序以 exit code 1 結束。

### 修法

Claude Code 2.x 的 `--mcp-config` 原生支援 HTTP 型 MCP server 與自訂 headers，
bridge 完全不再需要：

- `buildClaudeCommand` 直接以 inline JSON 傳入
  `{"mcpServers":{"discord-permissions":{"type":"http","url":"http://localhost:<port>/mcp","headers":{X-Discord-*}}}}`
- Discord context 改由 HTTP headers 傳遞（`src/mcp/server.ts` 的 `extractDiscordContext`
  原本就支援讀取這些 headers，無需修改）
- 加上 `--strict-mcp-config`：只載入 bot 的 permission server，不受伺服器上其他
  使用者/專案 MCP 設定影響
- 刪除 `mcp-bridge.cjs`、temp config 檔產生與清理邏輯（shell.ts 少了約 60 行）
- 伺服器不再需要 node（原本只有 bridge 用到），只需 bun + claude CLI

### 驗證

- vitest 54/54 通過（`bun run test:run`）
- 以 claude 2.1.202 實機測試：MCP server 狀態 `connected`、headers 正確送達、
  `approve_tool` 被呼叫並成功放行需要權限的 Bash 指令
- `PermissionManager` 回傳格式（`{behavior:'allow', updatedInput}` /
  `{behavior:'deny', message}`）與 2.x 要求相符，無需修改
