export const DEFAULT_PROJECT_CODE = `export default async function main(): Promise<void> {
  console.log("Ready");
}
`;

export const SAMPLE_PROJECT_NAME = "telegram message";

export const SAMPLE_PROJECT_ENV = [
  { key: "TOKEN", value: "", description: "" },
  { key: "CHAT_ID", value: "", description: "" },
] as const;

export const SAMPLE_PROJECT_CODE = `interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: { message_id: number };
}

interface SentMessageRow {
  id: number;
  message: string;
  sent_at: string;
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<number> {
  const response = await fetch(\`https://api.telegram.org/bot\${token}/sendMessage\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const result = (await response.json()) as TelegramResponse;
  if (!response.ok || !result.ok || !result.result) {
    throw new Error(\`Telegram API error (\${response.status}): \${result.description ?? "unknown error"}\`);
  }
  return result.result.message_id;
}

export default async function main(): Promise<void> {
  const token = env.TOKEN;
  const chatId = env.CHAT_ID;
  if (!token) throw new Error("TOKEN is not set");
  if (!chatId) throw new Error("CHAT_ID is not set");

  await sqlite.execute(\`
    CREATE TABLE IF NOT EXISTS sent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL
    )
  \`);

  const now = new Date();
  const text = \`🕒 \${now.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" })}\`;
  console.log("Sending:", text);

  const messageId = await sendTelegramMessage(token, chatId, text);
  console.log(\`Delivered (message_id: \${messageId})\`);

  await sqlite.execute({
    sql: "INSERT INTO sent_messages (chat_id, telegram_message_id, message, sent_at) VALUES (?, ?, ?, ?)",
    args: [chatId, messageId, text, now.toISOString()],
  });

  const { rows } = await sqlite.execute("SELECT COUNT(*) AS total FROM sent_messages");
  console.info(\`Total sent: \${rows[0]?.total}\`);

  const recent = db.query<SentMessageRow>("SELECT id, message, sent_at FROM sent_messages ORDER BY id DESC LIMIT 3");
  console.debug("Recent:", recent);
}
`;
