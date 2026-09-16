# QSchool — 校務回饋問卷與 AI 填答品質辨識平台

QSchool 是一個校務系統 Prototype，已拆分為「前台 Front Office」與「後台 Admin Console」。

## 角色與權限

### 前台：學生 Student
- 查看待填問卷
- 填寫課程回饋
- 查看自己已完成的問卷
- 不顯示 AI 品質分數或異常判斷

### 前台：教師 Teacher
- 查看待填問卷
- 填寫教學／行政支援回饋
- 查看自己已完成的問卷
- 不顯示 AI 品質分數或異常判斷

### 後台：管理員 Administrator
- 管理總覽 Dashboard
- 問卷管理
- 查看所有回覆
- AI 填答品質分析
- 查看需要人工複核的資料

## AI / 規則型品質辨識

目前 Prototype 已實作：
- Speeding：異常快速填答
- Straight-lining：大量相同答案
- Low Variance：量表答案變異過低
- Consistency：正反向題一致性
- Text Quality：開放式回答基本品質檢查
- Review Flag：多項異常時標記「建議人工複核」

系統不直接判定填答者「有沒有認真」，而是輸出可解釋的資料品質訊號。

## 每份問卷不同時怎麼處理

正式版建議在管理員建立／修改問卷時，先由 AI 將題目轉成統一 Question Schema：

```json
{
  "question_id": "q1",
  "type": "likert",
  "dimension": "teaching_clarity",
  "direction": "positive",
  "scale_min": 1,
  "scale_max": 5
}
```

這樣學生或教師每次填答時，不需要重新讓 AI 理解全部題目。

## AI API 建議串接位置

目前 `app.js` 的 `analyzeResponse()` 是前端規則型示範。正式系統請把品質分析移到後端。

建議 API：

```text
POST /api/surveys/:surveyId/responses
```

流程：

```text
Front Office
  ↓ 送出問卷
Backend
  ├─ 儲存 Response
  ├─ Rule Engine
  │   ├─ Speeding
  │   ├─ Straight-lining
  │   ├─ Variance
  │   └─ Consistency
  │
  └─ AI Service
      ├─ Text Relevance
      ├─ Specificity
      ├─ Meaningful Response
      ├─ Topic Extraction
      └─ Semantic Consistency
          ↓
        AI API
  ↓
Database
  ↓
Admin Console
```

### AI 文字分析 API

可新增：

```text
POST /api/ai/analyze-response
```

Request：

```json
{
  "survey_id": "student-course",
  "questions": [
    {
      "id": "q7",
      "text": "請描述一個本課程中對你最有幫助的部分",
      "dimension": "course_strength"
    }
  ],
  "answers": {
    "q7": "老師實際示範 prototype 測試流程，讓我比較能理解。"
  }
}
```

Response：

```json
{
  "relevance": "high",
  "specificity": "high",
  "meaningful_response": true,
  "topics": ["prototype", "實作示範"],
  "reason": "回答具體描述課堂內容，且與題目高度相關"
}
```

## API Key 放哪裡

不要把 AI API Key 放在 `app.js`、HTML 或公開 GitHub Repo。

正式版建議：

```text
backend/
  .env
  app.py / main.py
  services/
    ai_service.py
```

`.env`：

```text
OPENAI_API_KEY=your_key_here
```

並將 `.env` 加入 `.gitignore`。

## 現在怎麼執行

目前仍是零建置前端 Prototype：

1. 下載專案
2. 用瀏覽器開啟 `index.html`
3. 或使用 VS Code Live Server
4. 首頁可切換「學生 / 教師 / 管理員」三種角色

目前示範資料儲存在瀏覽器 `localStorage`。

## 正式版下一步

正式校務系統建議加入：
- 前端：React / Vue
- 後端：FastAPI / Flask / Node.js
- 資料庫：PostgreSQL / MySQL
- SSO / 校務帳號登入
- RBAC 角色權限
- 問卷建立器
- AI Question Schema 自動分類
- AI API
- 回覆匿名化／去識別化
- Audit Log
- Excel / CSV 匯出
- 資料保留與刪除政策
