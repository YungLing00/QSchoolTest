# QSchool — 學生回饋問卷與填答品質辨識平台

QSchool 是校務系統概念原型，示範「課程回饋問卷 + 可解釋的填答品質辨識」。

## 目前功能
- 學生課程回饋問卷（Likert + 開放題）
- 填答進度與本機資料儲存
- Speeding：異常快速填答
- Straight-lining：大量相同答案
- Low Variance：低變異回答
- Consistency：正向／反向題一致性
- Text Quality：開放題基本品質檢查
- 多項異常時標記「建議人工複核」
- 管理端品質分數、指標與回饋紀錄

> 系統不判定學生是否「認真」，而是提供可解釋的資料品質訊號。

## 執行
這是零建置版本。直接開啟 index.html 即可；也可以用 VS Code Live Server。

## AI API 要串在哪裡？
目前 `app.js` 的 `analyzeResponse()` 負責規則型辨識。正式串接 AI 時，**不要把 API Key 放在前端**。

建議新增後端：
```
POST /api/analyze-text
```

前端在送出問卷後，把「題目 + 開放式回答」送到後端，由後端呼叫 AI API，再回傳：
```json
{
  "relevance": "high",
  "specificity": "high",
  "meaningful_response": true,
  "topics": ["教學速度", "作業難度"],
  "reason": "回答有具體描述課程內容"
}
```

### 建議正式架構
```
Browser
  ↓ POST /api/surveys/:id/responses
Backend
  ├─ Rule Engine（時間、直線作答、變異、一致性）
  └─ AI Service（題目分類、文字相關性、具體程度、主題）
       ↓
    AI API
  ↓
Database
  ↓
Admin Dashboard
```

## 每份問卷不同時
正式版可在「建立／修改問卷」時只呼叫一次 AI，將題目轉成統一 schema：
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
學生作答時直接使用已儲存 schema，不必每次重新分析所有題目。

## 注意
目前為前端 MVP，資料存在瀏覽器 localStorage。正式校務系統需加入登入、權限、後端資料庫、去識別化、稽核紀錄與 API 金鑰管理。
