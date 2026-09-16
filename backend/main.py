import json, os, re, statistics
from pathlib import Path
from typing import Any, Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
load_dotenv()
app=FastAPI(title="QSchool API",version="0.2.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
DB=Path(__file__).with_name("data.json")
class Question(BaseModel):
 id:str; text:str; type:Literal["likert","text"]; dimension:str="general"; direction:Literal["positive","negative","neutral"]="neutral"
class Survey(BaseModel):
 id:str; title:str; description:str=""; audience:Literal["student","teacher","all"]; status:Literal["draft","active","closed"]="draft"; questions:list[Question]=[]
class ResponseIn(BaseModel):
 survey_id:str; role:Literal["student","teacher"]; duration:int=Field(ge=0); answers:dict[str,Any]
class ReviewIn(BaseModel):
 status:Literal["pending","accepted","excluded"]; note:str=""
def seed(): return {"surveys":[],"responses":[]}
def load():
 if not DB.exists(): save(seed())
 return json.loads(DB.read_text("utf-8"))
def save(d): DB.write_text(json.dumps(d,ensure_ascii=False,indent=2),"utf-8")
def analyze(qs,answers,duration):
 likert=[q for q in qs if q["type"]=="likert"]; nums=[int(answers[q["id"]]) for q in likert if answers.get(q["id"]) is not None]
 counts={v:nums.count(v) for v in set(nums)}; same=max(counts.values(),default=0); straight=bool(nums) and same/len(nums)>=.83
 variance=statistics.pvariance(nums) if len(nums)>1 else 0; low=len(nums)>1 and variance<.18; speeding=duration<35
 incons=False
 for a in likert:
  for b in likert:
   if a["id"]<b["id"] and a.get("dimension")==b.get("dimension") and a.get("direction")!=b.get("direction"):
    if abs(int(answers.get(a["id"],3))-(6-int(answers.get(b["id"],3))))>=3: incons=True
 texts=[str(answers.get(q["id"],"")).strip() for q in qs if q["type"]=="text"]
 junk=re.compile(r"^(無|沒有|不知道|都可以|很好|不錯|讚|ok|test|123|asdf|無意見)[。！! ]*$",re.I)
 textlow=any(len(t)<8 or junk.match(t) for t in texts) if texts else False
 flags=sum([speeding,straight,low,incons,textlow]); score=max(0,100-(22 if speeding else 0)-(25 if straight else 0)-(14 if low else 0)-(18 if incons else 0)-(15 if textlow else 0))
 return {"score":score,"review":flags>=2,"flags":flags,"review_status":"pending" if flags>=2 else "accepted","review_note":"","indicators":[{"name":"填答時間","en":"Speeding","bad":speeding,"detail":f"完成時間 {duration} 秒。"},{"name":"直線作答","en":"Straight-lining","bad":straight,"detail":f"最高相同選項 {same}/{len(nums)} 題。"},{"name":"答案變異","en":"Low Variance","bad":low,"detail":f"量表變異數 {variance:.2f}。"},{"name":"正反題一致性","en":"Consistency","bad":incons,"detail":"比較相同構面的正反向題。"},{"name":"文字品質","en":"Text Relevance","bad":textlow,"detail":"先以長度與常見無效文字檢查。"},{"name":"人工複核","en":"Review Flag","bad":flags>=2,"detail":f"共觸發 {flags} 項異常。"}],"text":{"responses":texts,"ai":None}}
def ai_text(survey,answers):
 if not os.getenv("OPENAI_API_KEY"): return None
 try:
  from openai import OpenAI
  client=OpenAI(); pairs=[{"question":q["text"],"answer":str(answers.get(q["id"],""))} for q in survey["questions"] if q["type"]=="text"]
  prompt='你是校務問卷資料品質分析器。只評估回答品質，不判斷人格或動機。輸出純 JSON：{"items":[{"relevance":"high|medium|low","specificity":"high|medium|low","meaningful":true,"topics":["..."],"reason":"繁中短句"}],"summary":"繁中短句"}。資料：'+json.dumps(pairs,ensure_ascii=False)
  raw=client.responses.create(model=os.getenv("OPENAI_MODEL","gpt-5-mini"),input=prompt).output_text.strip()
  return json.loads(re.sub(r"^"+chr(96)*3+r"json\s*|\s*"+chr(96)*3+r"$","",raw))
 except Exception as e: return {"error":str(e)}
@app.get("/api/health")
def health(): return {"ok":True,"ai_configured":bool(os.getenv("OPENAI_API_KEY"))}
@app.get("/api/surveys")
def get_surveys(role:str|None=None):
 d=load(); return [s for s in d["surveys"] if not role or s["audience"] in (role,"all")]
@app.post("/api/surveys")
def create(s:Survey):
 d=load()
 if any(x["id"]==s.id for x in d["surveys"]): raise HTTPException(409,"survey id exists")
 d["surveys"].append(s.model_dump()); save(d); return s
@app.put("/api/surveys/{sid}")
def update(sid:str,s:Survey):
 d=load(); i=next((i for i,x in enumerate(d["surveys"]) if x["id"]==sid),None)
 if i is None: raise HTTPException(404,"survey not found")
 d["surveys"][i]=s.model_dump(); save(d); return s
@app.delete("/api/surveys/{sid}")
def delete(sid:str):
 d=load(); n=len(d["surveys"]); d["surveys"]=[s for s in d["surveys"] if s["id"]!=sid]
 if len(d["surveys"])==n: raise HTTPException(404,"survey not found")
 save(d); return {"ok":True}
@app.post("/api/surveys/{sid}/responses")
def submit(sid:str,r:ResponseIn):
 d=load(); s=next((x for x in d["surveys"] if x["id"]==sid),None)
 if not s: raise HTTPException(404,"survey not found")
 a=analyze(s["questions"],r.answers,r.duration); a["text"]["ai"]=ai_text(s,r.answers)
 from datetime import datetime,timezone
 item={"id":int(datetime.now().timestamp()*1000),"role":r.role,"surveyId":sid,"surveyTitle":s["title"],"createdAt":datetime.now(timezone.utc).isoformat(),"duration":r.duration,"answers":r.answers,"analysis":a}
 d["responses"].insert(0,item); save(d); return item
@app.get("/api/responses")
def get_responses(): return load()["responses"]
@app.patch("/api/responses/{rid}/review")
def review(rid:int,r:ReviewIn):
 d=load(); item=next((x for x in d["responses"] if x["id"]==rid),None)
 if not item: raise HTTPException(404,"response not found")
 item["analysis"]["review_status"]=r.status; item["analysis"]["review_note"]=r.note; save(d); return item

def aggregate_topics(responses):
 rules=[
  ("講課速度太快",["太快","講太快","速度太快","跟不上","來不及","節奏太快"]),
  ("作業量／難度",["作業太多","作業很多","作業難","太難","負擔","作業量"]),
  ("說明不夠清楚",["聽不懂","不清楚","講不清楚","說明不清楚","難理解"]),
  ("希望增加互動",["互動","討論","問答","參與"]),
  ("希望增加實作",["實作","實際操作","練習","案例","示範","prototype"]),
  ("系統／行政流程",["系統","行政","流程","通知","操作","申請"])]
 out=[]
 for label,terms in rules:
  matched=[]
  for r in responses:
   texts=[str(v) for v in r.get("answers",{}).values() if isinstance(v,str) and not v.isdigit()]
   if any(any(k in t for k in terms) for t in texts): matched.append(r)
  if matched:
   out.append({"topic":label,"count":len(matched),"rate":round(len(matched)/max(len(responses),1)*100),"examples":[next((str(v) for v in x.get("answers",{}).values() if isinstance(v,str) and any(k in str(v) for k in terms)),"") for x in matched[:2]]})
 return sorted(out,key=lambda x:x["count"],reverse=True)
@app.get("/api/analytics/summary")
def analytics_summary(survey_id:str|None=None):
 d=load(); rows=d["responses"]
 if survey_id: rows=[r for r in rows if r.get("surveyId")==survey_id]
 valid=[r for r in rows if not r.get("analysis",{}).get("review")] or rows
 return {"responses":len(rows),"valid_responses":len(valid),"review_required":sum(1 for r in rows if r.get("analysis",{}).get("review")),"topics":aggregate_topics(valid)}
