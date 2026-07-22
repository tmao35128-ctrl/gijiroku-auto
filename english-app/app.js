/* ================= Eigo Quest — app logic ================= */
'use strict';

const $ = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0,10);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

/* ---------- persistent state ---------- */
const DEFAULT = {
  xp:0, gems:0, streak:0, lastStudy:null, dailyGoal:30, todayXp:0, todayDate:todayKey(),
  premium:false, sound:true, history:[], // history: array of YYYY-MM-DD studied
  srs:{} // en -> {box:0..5, due:'YYYY-MM-DD', learned:false}
};
let S = load();

function load(){
  try{
    const raw = JSON.parse(localStorage.getItem('eigoquest')||'{}');
    return Object.assign({}, DEFAULT, raw, {srs:Object.assign({}, raw.srs||{})});
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT)); }
}
function save(){ localStorage.setItem('eigoquest', JSON.stringify(S)); }

/* roll over the daily counter + streak when the date changes */
function rollDay(){
  const t = todayKey();
  if(S.todayDate !== t){ S.todayXp = 0; S.todayDate = t; save(); }
}

/* ---------- gamification ---------- */
function level(){ return Math.floor(S.xp/100)+1; }
function addXp(n){
  S.xp += n; S.todayXp += n;
  registerStudyDay();
  save(); renderHeader();
}
function addGems(n){ S.gems += n; save(); renderHeader(); }

function registerStudyDay(){
  const t = todayKey();
  if(S.lastStudy === t) return;
  const yesterday = new Date(Date.now()-864e5).toISOString().slice(0,10);
  S.streak = (S.lastStudy === yesterday) ? S.streak+1 : 1;
  S.lastStudy = t;
  if(!S.history.includes(t)) S.history.push(t);
  save();
}

/* ---------- navigation ---------- */
const VIEWS = ['home','study','speak','quiz','me'];
function go(v){
  VIEWS.forEach(x=>$('view-'+x).classList.toggle('active', x===v));
  document.querySelectorAll('.nav [data-nav]').forEach(b=>{
    const map = {study:'study',speak:'speak',home:'home',me:'me',quiz:'home'};
    b.classList.toggle('active', b.dataset.nav===map[v]);
  });
  window.scrollTo(0,0);
  if(v==='home') renderHome();
  if(v==='me') renderMe();
}

/* ---------- audio (TTS + speech recognition) ---------- */
const Audio = {
  say(text){
    if(!S.sound || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang='en-US'; u.rate=.92;
    const v = speechSynthesis.getVoices().find(x=>/en-US/i.test(x.lang));
    if(v) u.voice=v;
    speechSynthesis.speak(u);
  }
};

/* ---------- header / home rendering ---------- */
function renderHeader(){
  $('p-streak').textContent = S.streak;
  $('p-gems').textContent = S.gems;
}
function renderHome(){
  rollDay();
  const now = clamp(S.todayXp,0,S.dailyGoal);
  const pct = Math.round(now/S.dailyGoal*100);
  $('goalRing').style.setProperty('--p', pct);
  $('goalNow').textContent = now;
  $('goalMax').textContent = S.dailyGoal;
  $('lvl').textContent = level();
  $('totalXp').textContent = S.xp;
  const h = new Date().getHours();
  $('greet').textContent = (h<11?'おはよう ☀️':h<18?'こんにちは 👋':'こんばんは 🌙');
  $('goalMsg').textContent = now>=S.dailyGoal ? '今日の目標を達成！🎉' : `目標まであと ${S.dailyGoal-now} XP`;
  // due count
  const due = dueCards().length;
  const b = $('dueBadge');
  if(due>0){ b.style.display=''; b.textContent = `${due}枚`; } else b.style.display='none';
  renderWeek();
  const tip = TIPS[new Date().getDate() % TIPS.length];
  $('tipEn').textContent = tip.en; $('tipJp').textContent = tip.jp;
  renderHeader();
}
function renderWeek(){
  const wrap = $('weekCal'); wrap.innerHTML='';
  const labels=['日','月','火','水','木','金','土'];
  const today = new Date();
  for(let i=6;i>=0;i--){
    const d = new Date(Date.now()-i*864e5);
    const key = d.toISOString().slice(0,10);
    const done = S.history.includes(key);
    const isToday = key===today.toISOString().slice(0,10);
    const el = document.createElement('div');
    el.className = 'day'+(done?' done':'')+(isToday?' today':'');
    el.innerHTML = `<span class="dot">${done?'🔥':''}</span>${labels[d.getDay()]}`;
    wrap.appendChild(el);
  }
}

/* ---------- SRS core (Leitner) ---------- */
const BOX_DAYS = [0,1,2,4,7,15]; // interval per box
function srsFor(en){ return S.srs[en] || (S.srs[en]={box:0,due:todayKey(),learned:false}); }
function dueCards(){
  const t = todayKey();
  return DECK.filter(c => S.srs[c.en] && S.srs[c.en].learned && S.srs[c.en].due <= t);
}
function newCards(n=8){
  return DECK.filter(c => !S.srs[c.en] || !S.srs[c.en].learned).slice(0,n);
}
function scheduleCard(en, ok){
  const s = srsFor(en);
  s.learned = true;
  s.box = ok ? clamp(s.box+1,0,BOX_DAYS.length-1) : 0;
  const days = BOX_DAYS[s.box];
  s.due = new Date(Date.now()+days*864e5).toISOString().slice(0,10);
  save();
}
function learnedCount(){ return Object.values(S.srs).filter(x=>x.learned).length; }

/* ---------- Study (flashcards) ---------- */
const Study = {
  queue:[], i:0, gained:0, flipped:false,
  start(mode){
    rollDay();
    this.queue = mode==='review' ? dueCards() : newCards(8);
    if(this.queue.length===0){
      // fallback: mix in review or new
      this.queue = mode==='review' ? newCards(8) : dueCards();
    }
    if(this.queue.length===0){
      go('home'); toast(mode==='review'?'復習カードはありません 👍':'すべて学習済み！復習しましょう 🔁'); return;
    }
    this.i=0; this.gained=0; this.flipped=false;
    go('study'); this.render();
  },
  cur(){ return this.queue[this.i] || DECK[0]; },
  render(){
    const c=this.cur();
    $('fcWord').textContent=c.en; $('fcPhon').textContent=c.phon;
    $('fcJp').textContent=c.jp;
    $('fcEx').innerHTML=`<span class="en">${c.exEn}</span><br>${c.exJp}`;
    $('flashcard').classList.remove('flipped'); this.flipped=false;
    $('rateBox').style.display='none'; $('flipHint').style.display='';
    $('studyCount').textContent=`${this.i+1}/${this.queue.length}`;
    $('studyBar').style.width=(this.i/this.queue.length*100)+'%';
    Audio.say(c.en);
  },
  flip(){
    if(this.flipped) return;
    this.flipped=true;
    $('flashcard').classList.add('flipped');
    $('rateBox').style.display=''; $('flipHint').style.display='none';
  },
  rate(ok){
    if(!this.flipped){ this.flip(); return; }
    scheduleCard(this.cur().en, ok);
    if(ok){ addXp(5); this.gained+=5; }
    this.i++;
    if(this.i>=this.queue.length){ this.finish(); return; }
    this.render();
  },
  finish(){
    $('studyBar').style.width='100%';
    const gems = Math.round(this.gained/5);
    addGems(gems);
    showResult('🎓','単語セッション完了！', this.gained, gems,
      `${this.queue.length}枚を学習しました。忘れる前に復習が届きます 🔁`);
  }
};

/* ---------- Speaking ---------- */
const Speak = {
  queue:[], i:0, gained:0, rec:null, busy:false,
  start(){
    this.queue=[...PHRASES].sort(()=>Math.random()-.5).slice(0,6);
    this.i=0; this.gained=0;
    go('speak'); this.render();
  },
  cur(){ return this.queue[this.i]||PHRASES[0]; },
  render(){
    const p=this.cur();
    $('phraseEn').textContent=p.en; $('phraseJp').textContent=p.jp;
    $('speakCount').textContent=`${this.i+1}/${this.queue.length}`;
    $('speakBar').style.width=(this.i/this.queue.length*100)+'%';
    $('heardText').textContent=''; $('scoreBadge').classList.remove('show');
    $('micLabel').textContent='タップして話す'; $('micBtn').classList.remove('listening');
    setTimeout(()=>Audio.say(p.en),350);
  },
  listen(){
    if(this.busy) return;
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ // graceful fallback when recognition unsupported (iOS Safari etc.)
      $('heardText').textContent='(このブラウザは音声認識に未対応。お手本を聞いて発音しましょう)';
      this.score(null, true); return;
    }
    this.busy=true;
    const r=new SR(); this.rec=r;
    r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
    $('micBtn').classList.add('listening'); $('micLabel').textContent='聞き取り中…話してください';
    r.onresult=e=>{ const said=e.results[0][0].transcript; $('heardText').textContent=`あなた：「${said}」`; this.score(said,false); };
    r.onerror=()=>{ $('heardText').textContent='うまく聞き取れませんでした。もう一度どうぞ 🎤'; this.reset(); };
    r.onend=()=>{ this.reset(); };
    try{ r.start(); }catch(e){ this.reset(); }
  },
  reset(){ this.busy=false; $('micBtn').classList.remove('listening'); if($('micLabel').textContent.includes('聞き取り')) $('micLabel').textContent='タップして話す'; },
  score(said, unsupported){
    let sc;
    if(unsupported){ sc=null; }
    else{
      const norm=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim().split(/\s+/);
      const a=norm(said), b=norm(this.cur().en);
      const setB=new Set(b);
      const hit=a.filter(w=>setB.has(w)).length;
      sc=clamp(Math.round(hit/b.length*100),0,100);
    }
    const badge=$('scoreBadge'); badge.classList.add('show');
    if(sc===null){
      $('scoreNum').textContent='🎧'; $('scoreNum').style.color='var(--purple)';
      $('scoreMsg').textContent='お手本を聞いて練習しよう';
      addXp(3); this.gained+=3;
    }else{
      $('scoreNum').textContent=sc+'点';
      $('scoreNum').style.color = sc>=80?'var(--good)':sc>=50?'var(--gold)':'var(--danger)';
      $('scoreMsg').textContent = sc>=80?'素晴らしい発音！🎉':sc>=50?'いい調子！もう少し 💪':'お手本を聞いてリトライ 🎧';
      const gain = sc>=80?8:sc>=50?5:2;
      addXp(gain); this.gained+=gain;
    }
    this.reset();
  },
  next(){
    this.i++;
    if(this.i>=this.queue.length){ this.finish(); return; }
    this.render();
  },
  finish(){
    $('speakBar').style.width='100%';
    const gems=Math.max(1,Math.round(this.gained/8));
    addGems(gems);
    showResult('🎙️','スピーキング完了！', this.gained, gems, '声に出すほど話せるようになります。毎日続けよう！');
  }
};

/* ---------- Quiz ---------- */
const Quiz = {
  queue:[], i:0, correct:0, gained:0,
  start(){
    this.queue=[...DECK].sort(()=>Math.random()-.5).slice(0,8);
    this.i=0; this.correct=0; this.gained=0;
    go('quiz'); this.render();
  },
  render(){
    const c=this.queue[this.i];
    $('qWord').textContent=c.en;
    $('quizCount').textContent=`${this.i+1}/${this.queue.length}`;
    $('quizBar').style.width=(this.i/this.queue.length*100)+'%';
    const wrong=DECK.filter(x=>x.en!==c.en).sort(()=>Math.random()-.5).slice(0,3);
    const opts=[c,...wrong].sort(()=>Math.random()-.5);
    const box=$('qChoices'); box.innerHTML='';
    Audio.say(c.en);
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='choice'; b.textContent=o.jp;
      b.onclick=()=>this.answer(b,o.en===c.en,c.en);
      box.appendChild(b);
    });
  },
  answer(btn,ok,correctEn){
    [...$('qChoices').children].forEach(b=>b.disabled=true);
    if(ok){ btn.classList.add('correct'); this.correct++; addXp(4); this.gained+=4; }
    else{
      btn.classList.add('wrong');
      [...$('qChoices').children].forEach(b=>{ if(b.textContent===DECK.find(d=>d.en===correctEn).jp) b.classList.add('correct'); });
    }
    setTimeout(()=>{
      this.i++;
      if(this.i>=this.queue.length){ this.finish(); return; }
      this.render();
    }, ok?650:1300);
  },
  finish(){
    $('quizBar').style.width='100%';
    const gems=this.correct;
    addGems(gems);
    showResult(this.correct>=6?'🏆':'✅', `クイズ結果：${this.correct}/${this.queue.length}正解`,
      this.gained, gems, this.correct>=6?'お見事！語彙力が上がっています 📈':'間違えた単語はカードで復習しよう 📇');
  }
};

/* ---------- result overlay ---------- */
function showResult(emoji,title,xp,gems,msg){
  $('rEmoji').textContent=emoji; $('rTitle').textContent=title;
  $('rXp').textContent='+'+xp; $('rGems').textContent='+'+gems; $('rMsg').textContent=msg;
  $('result').classList.add('show');
  if(navigator.vibrate) navigator.vibrate(30);
}
function closeResult(){ $('result').classList.remove('show'); go('home'); }

/* ---------- my page ---------- */
function renderMe(){
  rollDay();
  $('m-streak').textContent=S.streak;
  $('m-words').textContent=learnedCount();
  $('m-xp').textContent=S.xp;
  $('joinInfo').textContent=`レベル ${level()} ・ ${S.premium?'プレミアム会員 ⭐':'無料プラン'}`;
  $('soundState').textContent=S.sound?'ON':'OFF';
  $('goalSetting').textContent=S.dailyGoal+' XP';
  const ap=['😀','😎','🤓','🥳','🦉','🚀'];
  $('avatar').textContent=ap[level()%ap.length];
  renderHeader();
}
function upgrade(){
  S.premium=true; save();
  toast('プレミアム体験を開始しました ⭐（デモ）');
  renderMe();
}
function toggleSound(){ S.sound=!S.sound; save(); $('soundState').textContent=S.sound?'ON':'OFF'; toast('音声：'+(S.sound?'ON':'OFF')); }
function resetData(){
  if(confirm('学習データをすべてリセットしますか？この操作は取り消せません。')){
    localStorage.removeItem('eigoquest'); S=load(); renderHome(); go('home'); toast('データをリセットしました');
  }
}

/* ---------- toast ---------- */
let toastT;
function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---------- boot ---------- */
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=()=>{}; }
rollDay();
renderHome();
renderHeader();
