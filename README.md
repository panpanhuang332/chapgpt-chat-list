# ChatGPT 對話知識庫

這是一個可部署到 GitHub Pages 的純靜態網站，用來瀏覽 ChatGPT 匯出資料中的歷史對話。

## 重要限制

Codex 不能直接登入或讀取你的 ChatGPT 帳號歷史。你需要先從 OpenAI 匯出資料，解壓縮後取得 `conversations.json`，再用本專案的匯入工具轉成網站資料。

OpenAI 官方說明：<https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data>

如果你的 GitHub repo 是公開的，匯入後的聊天內容也會公開。請先確認裡面沒有密碼、API key、私人文件、身份資料或不想公開的內容。

## 匯入資料

1. 從 ChatGPT 或 OpenAI Privacy Portal 匯出你的資料。
2. 下載並解壓縮匯出的 zip。
3. 找到解壓縮資料中的 `conversations.json`。
4. 在此專案根目錄執行：

```bash
node tools/import-chatgpt-export.mjs path/to/conversations.json
```

匯入完成後會覆寫 `data/conversations.js`，網站會直接讀取這個檔案。

預設只保留 user 與 assistant 訊息。如需包含 system 或 tool 訊息：

```bash
node tools/import-chatgpt-export.mjs path/to/conversations.json --include-system --include-tool
```

## 本機預覽

直接打開 `index.html` 即可預覽。也可以用本機伺服器：

```bash
python -m http.server 8080
```

然後開啟 <http://localhost:8080>。

## 部署到 GitHub Pages

1. 建立 GitHub repository。
2. 將本專案檔案 push 到 repository。
3. 到 repo 的 `Settings` -> `Pages`。
4. Source 選 `GitHub Actions`。
5. push 到 `main` 後，`.github/workflows/pages.yml` 會發布網站。

完成後 GitHub 會提供一個 Pages 網址。

也可以不用 Actions，改用 `Deploy from a branch`，branch 選 `main`，資料夾選 `/root`。
