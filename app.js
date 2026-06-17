const archive = normalizeArchive(window.CHATGPT_ARCHIVE);

const state = {
  conversations: archive.conversations,
  activeId: null,
  query: "",
  sort: "updated",
  role: "all",
};

const elements = {
  archiveMeta: document.querySelector("#archiveMeta"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  roleSelect: document.querySelector("#roleSelect"),
  conversationCount: document.querySelector("#conversationCount"),
  messageCount: document.querySelector("#messageCount"),
  conversationList: document.querySelector("#conversationList"),
  conversationDetail: document.querySelector("#conversationDetail"),
};

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

elements.roleSelect.addEventListener("change", (event) => {
  state.role = event.target.value;
  render();
});

window.addEventListener("hashchange", () => {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (id) {
    state.activeId = id;
    render();
  }
});

render();

function normalizeArchive(input) {
  const fallback = {
    generatedAt: null,
    source: "data/conversations.js",
    conversations: [],
  };

  if (!input) {
    return fallback;
  }

  const conversations = Array.isArray(input) ? input : input.conversations;
  return {
    ...fallback,
    ...input,
    conversations: Array.isArray(conversations) ? conversations.map(normalizeConversation) : [],
  };
}

function normalizeConversation(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  return {
    id: String(conversation.id || conversation.conversation_id || crypto.randomUUID()),
    title: conversation.title || "Untitled conversation",
    createTime: conversation.createTime || conversation.create_time || null,
    updateTime: conversation.updateTime || conversation.update_time || null,
    messages: messages.map((message, index) => ({
      id: String(message.id || `${conversation.id || "conversation"}-${index}`),
      role: message.role || message.author || "unknown",
      time: message.time || message.createTime || message.create_time || null,
      model: message.model || "",
      content: String(message.content || ""),
    })),
  };
}

function render() {
  const filtered = getFilteredConversations();
  const active = getActiveConversation(filtered);

  renderMeta(filtered);
  renderList(filtered, active);
  renderDetail(active);
}

function getFilteredConversations() {
  const query = state.query;
  const role = state.role;

  const filtered = state.conversations
    .map((conversation) => {
      const messages =
        role === "all"
          ? conversation.messages
          : conversation.messages.filter((message) => message.role === role);

      return {
        ...conversation,
        visibleMessages: messages,
      };
    })
    .filter((conversation) => {
      if (conversation.visibleMessages.length === 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        conversation.title,
        conversation.createTime,
        conversation.updateTime,
        ...conversation.visibleMessages.map((message) => `${message.role} ${message.model} ${message.content}`),
      ]
        .join("\n")
        .toLowerCase();

      return haystack.includes(query);
    });

  return filtered.sort(compareConversations);
}

function compareConversations(a, b) {
  if (state.sort === "title") {
    return a.title.localeCompare(b.title, "zh-Hant");
  }

  if (state.sort === "created") {
    return toTime(a.createTime) - toTime(b.createTime);
  }

  if (state.sort === "messages") {
    return b.visibleMessages.length - a.visibleMessages.length;
  }

  return toTime(b.updateTime || b.createTime) - toTime(a.updateTime || a.createTime);
}

function getActiveConversation(conversations) {
  if (conversations.length === 0) {
    state.activeId = null;
    return null;
  }

  const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hashId && conversations.some((conversation) => conversation.id === hashId)) {
    state.activeId = hashId;
  }

  if (!state.activeId || !conversations.some((conversation) => conversation.id === state.activeId)) {
    state.activeId = conversations[0].id;
  }

  return conversations.find((conversation) => conversation.id === state.activeId);
}

function renderMeta(conversations) {
  const totalMessages = state.conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0);
  const visibleMessages = conversations.reduce((sum, conversation) => sum + conversation.visibleMessages.length, 0);
  const generated = archive.generatedAt ? formatDate(archive.generatedAt) : "尚未產生資料";

  elements.conversationCount.textContent = conversations.length.toLocaleString("zh-Hant");
  elements.messageCount.textContent = visibleMessages.toLocaleString("zh-Hant");
  elements.archiveMeta.textContent =
    state.conversations.length === 0
      ? "等待匯入 ChatGPT 匯出資料"
      : `產生於 ${generated}，共 ${state.conversations.length.toLocaleString("zh-Hant")} 則對話 / ${totalMessages.toLocaleString("zh-Hant")} 則訊息`;
}

function renderList(conversations, active) {
  if (state.conversations.length === 0) {
    elements.conversationList.innerHTML = '<p class="empty-list">沒有可顯示的資料</p>';
    return;
  }

  if (conversations.length === 0) {
    elements.conversationList.innerHTML = '<p class="empty-list">找不到符合條件的對話</p>';
    return;
  }

  elements.conversationList.innerHTML = conversations
    .map((conversation) => {
      const isActive = active && conversation.id === active.id;
      return `
        <button class="conversation-item${isActive ? " active" : ""}" type="button" data-id="${escapeAttribute(conversation.id)}">
          <span class="conversation-title">${escapeHtml(conversation.title)}</span>
          <span class="conversation-subtitle">
            <span>${conversation.visibleMessages.length.toLocaleString("zh-Hant")} 則訊息</span>
            <span>${formatDate(conversation.updateTime || conversation.createTime)}</span>
          </span>
        </button>
      `;
    })
    .join("");

  elements.conversationList.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      state.activeId = id;
      window.location.hash = encodeURIComponent(id);
      render();
    });
  });
}

function renderDetail(conversation) {
  if (state.conversations.length === 0) {
    elements.conversationDetail.innerHTML = `
      <div class="empty">
        <h2>尚未載入任何對話</h2>
        <p>我無法直接讀取你的 ChatGPT 帳號歷史。請從 OpenAI 匯出資料，解壓縮後把 <code>conversations.json</code> 交給匯入工具。</p>
        <pre><code>node tools/import-chatgpt-export.mjs path/to/conversations.json</code></pre>
        <p>如果 GitHub 倉庫是公開的，產生出的靜態資料也會公開。</p>
      </div>
    `;
    return;
  }

  if (!conversation) {
    elements.conversationDetail.innerHTML = `
      <div class="empty">
        <h2>沒有符合條件的對話</h2>
        <p>調整搜尋字或角色篩選後再試一次。</p>
      </div>
    `;
    return;
  }

  const messages = conversation.visibleMessages;
  elements.conversationDetail.innerHTML = `
    <div class="conversation-head">
      <h2>${escapeHtml(conversation.title)}</h2>
      <div class="conversation-facts">
        <span class="pill">${messages.length.toLocaleString("zh-Hant")} 則目前顯示訊息</span>
        <span class="pill">建立 ${formatDate(conversation.createTime)}</span>
        <span class="pill">更新 ${formatDate(conversation.updateTime || conversation.createTime)}</span>
      </div>
    </div>
    <div class="timeline">
      ${messages.map(renderMessage).join("")}
    </div>
  `;
}

function renderMessage(message) {
  const role = normalizeRole(message.role);
  const label = roleLabel(role);
  const model = message.model ? `<span>${escapeHtml(message.model)}</span>` : "";

  return `
    <section class="message ${escapeAttribute(role)}">
      <div class="message-role">
        <span>${label}</span>
        <time>${formatDate(message.time)}</time>
        ${model}
      </div>
      <div class="message-body">
        <div class="content">${renderContent(message.content)}</div>
      </div>
    </section>
  `;
}

function renderContent(text) {
  if (!text.trim()) {
    return "<p><em>空白訊息</em></p>";
  }

  const parts = [];
  const pattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(renderParagraphs(text.slice(cursor, match.index)));
    }

    const language = match[1] ? ` data-language="${escapeAttribute(match[1].trim())}"` : "";
    parts.push(`<pre${language}><code>${escapeHtml(match[2].trim())}</code></pre>`);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(renderParagraphs(text.slice(cursor)));
  }

  return parts.join("");
}

function renderParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${linkify(escapeHtml(paragraph)).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function linkify(html) {
  return html.replace(
    /\bhttps?:\/\/[^\s<]+/g,
    (url) => `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${url}</a>`,
  );
}

function normalizeRole(role) {
  const value = String(role || "unknown").toLowerCase();
  if (["user", "assistant", "system", "tool"].includes(value)) {
    return value;
  }
  return "unknown";
}

function roleLabel(role) {
  if (role === "user") return "我";
  if (role === "assistant") return "ChatGPT";
  if (role === "system") return "System";
  if (role === "tool") return "Tool";
  return "Unknown";
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
