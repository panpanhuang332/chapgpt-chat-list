#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const args = parseArgs(process.argv.slice(2));

if (!args.input || args.help) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const inputPath = path.resolve(process.cwd(), args.input);
const outputPath = path.resolve(process.cwd(), args.out || "data/conversations.js");
const includeSystem = Boolean(args["include-system"]);
const includeTool = Boolean(args["include-tool"]);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Input file not found: ${inputPath}`);
}

const rawText = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const raw = JSON.parse(rawText);
const conversations = normalizeExport(raw, { includeSystem, includeTool });
const archive = {
  generatedAt: new Date().toISOString(),
  source: "ChatGPT data export conversations.json",
  conversationCount: conversations.length,
  messageCount: conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0),
  conversations,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `window.CHATGPT_ARCHIVE = ${JSON.stringify(archive, null, 2)};\n`, "utf8");

console.log(`Imported ${archive.conversationCount} conversations and ${archive.messageCount} messages.`);
console.log(`Wrote ${path.relative(process.cwd(), outputPath) || outputPath}`);

function parseArgs(argv) {
  const parsed = { input: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    if (token.startsWith("--")) {
      const [name, inlineValue] = token.slice(2).split("=", 2);
      const next = argv[index + 1];
      if (inlineValue !== undefined) {
        parsed[name] = inlineValue;
      } else if (next && !next.startsWith("--")) {
        parsed[name] = next;
        index += 1;
      } else {
        parsed[name] = true;
      }
      continue;
    }

    if (!parsed.input) {
      parsed.input = token;
    }
  }

  return parsed;
}

function normalizeExport(raw, options) {
  const source = Array.isArray(raw) ? raw : raw.conversations;
  if (!Array.isArray(source)) {
    throw new Error("Expected ChatGPT export conversations.json to contain an array.");
  }

  return source
    .map((conversation, index) => normalizeConversation(conversation, index, options))
    .filter((conversation) => conversation.messages.length > 0)
    .sort((a, b) => toTime(b.updateTime || b.createTime) - toTime(a.updateTime || a.createTime));
}

function normalizeConversation(conversation, index, options) {
  const id = String(conversation.id || conversation.conversation_id || `conversation-${index + 1}`);
  const nodes = conversation.mapping ? Object.values(conversation.mapping) : [];
  const messages = nodes
    .map((node, nodeIndex) => normalizeMessage(node, nodeIndex))
    .filter((message) => shouldKeepMessage(message, options))
    .sort((a, b) => {
      const byTime = toTime(a.time) - toTime(b.time);
      return byTime === 0 ? a.index - b.index : byTime;
    })
    .map(({ index: _index, ...message }) => message);

  return {
    id,
    title: cleanTitle(conversation.title) || `Conversation ${index + 1}`,
    createTime: fromUnix(conversation.create_time),
    updateTime: fromUnix(conversation.update_time || conversation.create_time),
    messages,
  };
}

function normalizeMessage(node, index) {
  const message = node && node.message ? node.message : null;
  const role = message?.author?.role || "unknown";
  const metadata = message?.metadata || {};

  return {
    index,
    id: String(message?.id || node?.id || `message-${index + 1}`),
    role,
    time: fromUnix(message?.create_time || message?.update_time),
    model: metadata.model_slug || metadata.default_model_slug || "",
    content: contentToText(message?.content),
  };
}

function shouldKeepMessage(message, options) {
  if (!message.content.trim()) {
    return false;
  }

  if (message.role === "system" && !options.includeSystem) {
    return false;
  }

  if (message.role === "tool" && !options.includeTool) {
    return false;
  }

  return true;
}

function contentToText(content) {
  if (!content) {
    return "";
  }

  if (Array.isArray(content.parts)) {
    return content.parts.map(partToText).filter(Boolean).join("\n\n");
  }

  if (typeof content.text === "string") {
    return content.text;
  }

  if (Array.isArray(content.result)) {
    return content.result.map(partToText).filter(Boolean).join("\n\n");
  }

  if (content.content_type) {
    return `[${content.content_type}] ${safeStringify(content)}`;
  }

  return safeStringify(content);
}

function partToText(part) {
  if (typeof part === "string") {
    return part;
  }

  if (!part || typeof part !== "object") {
    return "";
  }

  if (typeof part.text === "string") {
    return part.text;
  }

  if (part.content_type === "image_asset_pointer") {
    return `[Image: ${part.asset_pointer || "image"}]`;
  }

  if (part.content_type === "audio_asset_pointer") {
    return `[Audio: ${part.asset_pointer || "audio"}]`;
  }

  if (part.content_type) {
    return `[${part.content_type}] ${safeStringify(part)}`;
  }

  return safeStringify(part);
}

function cleanTitle(title) {
  return String(title || "").replace(/\s+/g, " ").trim();
}

function fromUnix(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return new Date(numeric * 1000).toISOString();
}

function toTime(value) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function printHelp() {
  console.log(`
Usage:
  node tools/import-chatgpt-export.mjs path/to/conversations.json [--out data/conversations.js]

Options:
  --include-system    Include system messages from the export.
  --include-tool      Include tool messages from the export.

The input should be the conversations.json file from an OpenAI ChatGPT data export.
`);
}
