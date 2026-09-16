const QUESTIONS=[
 {id:"q1",text:"教師能清楚說明課程內容與學習目標。",type:"likert",dimension:"teaching_clarity",direction:"positive"},
 {id:"q2",text:"課程內容能幫助我理解互動設計的核心概念。",type:"likert",dimension:"learning_value",direction:"positive"},
 {id:"q3",text:"課堂活動與作業能促進我的實際應用能力。",type:"likert",dimension:"practical_learning",direction:"positive"},
 {id:"q4",text:"我在課程中經常不知道老師正在說明什麼。",type:"likert",dimension:"teaching_clarity",direction:"negative"},
 {id:"q5",text:"教師願意回應學生的問題與意見。",type:"likert",dimension:"teacher_interaction",direction:"positive"},
 {id:"q6",text:"整體而言，我對本課程的學習經驗感到滿意。",type:"likert",dimension:"overall_satisfaction",direction:"positive"},
 {id:"q7",text:"請描述一個本課程中對你最有幫助的部分，並簡單說明原因。",type:"text",dimension:"course_strength"},
 {id:"q8",text:"你認為這門課最需要改善的地方是什麼？",type:"text",dimension:"course_improvement"}
];
let startedAt=Date.now();

function renderQuestions(){
 const root=document.getElementById("questions");
 root.innerHTML=QUESTIONS.map((q,i)=>q.type==="likert"?`
 <div class="question"><div class="question-label"><span class="qnum">${String(i+1).padStart(2,"0")}</span><span>${q.text}</span></div>
 <div class="scale">${[1,2,3,4,5].map(v=>`<label><input required type="radio" name="${q.id}" value="${v}"><b>${v}</b><small>${["非常不同意","不同意","普通","同意","非常同意"][v-1]}</small></label>`).join("")}</div></div>`
 :`<div class="question"><div class="question-label"><span class="qnum">${String(i+1).padStart(2,"0")}</span><span>${q.text}</span></div><textarea required name="${q.id}" placeholder="請輸入你的回饋…"></textarea></div>`).join("");
 root.querySelectorAll("input,textarea").forEach(el=>el.addEventListener("input",updateProgress));
}
function updateProgress(){
 let done=0; QUESTIONS.forEach(q=>{const el=document.querySelector(`[name="${q.id}"]:checked`)||document.querySelector(`textarea[name="${q.id}"]`);if(el&&el.value.trim())done++});
 document.getElementById("progressText").textContent=`${done} / ${QUESTIONS.length}`;
 document.getElementById("progressBar").style.width=`${done/QUESTIONS.length*100}%`;
}
function analyzeResponse(answers,duration){
 const nums=QUESTIONS.filter(q=>q.type==="likert").map(q=>Number(answers[q.id]));
 const counts={};nums.forEach(v=>counts[v]=(counts[v]||0)+1);
 const maxSame=Math.max(...Object.values(counts)); const straight=maxSame/nums.length>=.83;
 const mean=nums.reduce((a,b)=>a+b,0)/nums.length;
 const variance=nums.reduce((s,v)=>s+(v-mean)**2,0)/nums.length;
 const lowVariance=variance<.18;
 const speeding=duration<35;
 const q1=Number(answers.q1),q4=Number(answers.q4);
 const inconsistency=Math.abs(q1-(6-q4))>=3;
 const texts=[answers.q7,answers.q8];
 const junk=/^(無|沒有|不知道|都可以|很好|不錯|讚|ok|test|123|asdf|無意見)[。！! ]*$/i;
 const weakTexts=texts.filter(t=>t.trim().length<8||junk.test(t.trim())).length;
 const textLow=weakTexts>=1;
 const flags=[speeding,straight,lowVariance,inconsistency,textLow].filter(Boolean).length;
 let score=100-(speeding?22:0)-(straight?25:0)-(lowVariance?14:0)-(inconsistency?18:0)-(textLow?15:0);
 score=Math.max(0,score);
 return {score,review:flags>=2,flags,indicators:[
  {name:"填答時間",en:"Speeding",bad:speeding,detail:speeding?`僅用 ${duration} 秒完成，低於示範門檻 35 秒。`:`完成時間 ${duration} 秒，未觸發過快門檻。`},
  {name:"直線作答",en:"Straight-lining",bad:straight,detail:straight?`${maxSame}/${nums.length} 題選擇相同選項。`:"量表答案有合理變化。"},
  {name:"答案變異",en:"Low Variance",bad:lowVariance,detail:`量表變異數為 ${variance.toFixed(2)}。`},
  {name:"正反題一致性",en:"Consistency",bad:inconsistency,detail:inconsistency?"相同構面的正反向題出現明顯落差。":"正反向題未發現明顯矛盾。"},
  {name:"文字品質",en:"Text Relevance",bad:textLow,detail:textLow?"至少一則文字過短、空泛或疑似無效。":"文字回答具有基本內容長度。"},
  {name:"人工複核",en:"Review Flag",bad:flags>=2,detail:flags>=2?`共觸發 ${flags} 項異常，建議人工複核。`:"未達人工複核門檻。"}
 ],text:{responses:texts,mode:"heuristic",note:"目前為本機規則分析；串接 AI API 後可進一步判斷語意相關性、具體程度、主題與矛盾。"}};
}
document.getElementById("surveyForm").addEventListener("submit",e=>{
 e.preventDefault();const fd=new FormData(e.target),answers={};QUESTIONS.forEach(q=>answers[q.id]=fd.get(q.id));
 const duration=Math.max(1,Math.round((Date.now()-startedAt)/1000));const analysis=analyzeResponse(answers,duration);
 const data=getResponses();data.unshift({id:Date.now(),createdAt:new Date().toISOString(),duration,answers,analysis});localStorage.setItem("qschool_responses",JSON.stringify(data));
 toast("問卷已送出，品質分析完成");refreshAll();goTo("analysis");
});
function getResponses(){try{return JSON.parse(localStorage.getItem("qschool_responses")||"[]")}catch{return[]}}
function refreshAll(){
 const data=getResponses();document.getElementById("statResponses").textContent=data.length;
 document.getElementById("statScore").textContent=data.length?Math.round(data.reduce((s,r)=>s+r.analysis.score,0)/data.length):"—";
 document.getElementById("statReview").textContent=data.filter(r=>r.analysis.review).length;
 document.getElementById("statText").textContent=data.length*2;
 const sel=document.getElementById("analysisSelect");sel.innerHTML=data.length?data.map((r,i)=>`<option value="${r.id}">回覆 #${data.length-i} · ${new Date(r.createdAt).toLocaleString("zh-TW")}</option>`).join(""):"<option>尚無資料</option>";
 document.getElementById("responseRows").innerHTML=data.length?data.map((r,i)=>`<tr><td>#${data.length-i}</td><td>${new Date(r.createdAt).toLocaleString("zh-TW")}</td><td>${r.duration}s</td><td><b>${r.analysis.score}</b></td><td><span class="${r.analysis.review?"quality-badge warn":"quality-badge ok"}">${r.analysis.review?"建議複核":"品質正常"}</span></td></tr>`).join(""):`<tr><td colspan="5">尚無回饋紀錄</td></tr>`;
 renderAnalysis(data[0]);
}
function renderAnalysis(r){
 document.getElementById("analysisEmpty").classList.toggle("hidden",!!r);document.getElementById("analysisContent").classList.toggle("hidden",!r);if(!r)return;
 const a=r.analysis;document.getElementById("qualityScore").textContent=a.score;document.querySelector(".score-ring.small").style.setProperty("--score",a.score+"%");
 const badge=document.getElementById("qualityBadge");badge.textContent=a.review?"建議人工複核":"品質正常";badge.className="quality-badge "+(a.review?"warn":"ok");
 document.getElementById("qualityTitle").textContent=a.review?"偵測到多項需要留意的品質指標":"目前未偵測到重大填答異常";
 document.getElementById("qualitySummary").textContent=a.review?`本回覆觸發 ${a.flags} 項品質指標。系統僅提供異常訊號，最終是否排除資料仍應由管理者依研究規範判斷。`:"本回覆通過目前的規則型品質檢查，可進一步搭配 AI 語意分析文字意見。";
 document.getElementById("indicators").innerHTML=a.indicators.map(x=>`<div class="indicator"><div class="indicator-top"><span class="kicker">${x.en}</span><span class="quality-badge ${x.bad?"warn":"ok"}">${x.bad?"需留意":"正常"}</span></div><h4>${x.name}</h4><p>${x.detail}</p></div>`).join("");
 document.getElementById("textAnalysis").innerHTML=a.text.responses.map((t,i)=>`<div class="text-card" style="margin-bottom:10px"><blockquote>「${escapeHtml(t)}」</blockquote><div class="chips"><span class="chip">回答長度：${t.trim().length} 字</span><span class="chip">本機規則檢查</span><span class="chip">待 AI 語意分析</span></div></div>`).join("")+`<p style="font-size:10px;color:#7b879a">${a.text.note}</p>`;
}
document.getElementById("analysisSelect").addEventListener("change",e=>renderAnalysis(getResponses().find(r=>String(r.id)===e.target.value)));
function goTo(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(id).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===id));document.getElementById("pageTitle").textContent={dashboard:"問卷總覽",survey:"學生課程回饋",analysis:"AI 品質分析",responses:"回饋紀錄"}[id];window.scrollTo(0,0)}
document.querySelectorAll(".nav-item").forEach(n=>n.onclick=()=>goTo(n.dataset.page));
function resetSurvey(){document.getElementById("surveyForm").reset();startedAt=Date.now();updateProgress()}
function clearResponses(){if(confirm("確定清除所有本機示範資料？")){localStorage.removeItem("qschool_responses");refreshAll();toast("示範資料已清除")}}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
renderQuestions();refreshAll();