"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BOARD_OPTIONS, GRADE_OPTIONS, curriculumFor, curriculumStats, curriculumSubjects } from "./curriculum";
import { calculateDailyStreak, completeDailyLoop, createDailyLoopState, getDailyRecommendation, localDayKey, parseDailyLoopState, rollDailyLoop, type DailyLoopState, type LoopConfidence } from "./daily-loop";
import { ARENA_RULES, arenaWeekKey, buildSkillAttemptId, calculateMicroWins, countMeasuredSignals, createSkillsArenaState, getCompetitionAccess, getWeakestSignalCoaching, parseSkillsArenaState, recordSkillAttempt, serializeSkillsArenaState, skillsArenaStorageKey, type ArenaSkill, type CompetitionScope, type MeasuredSignals, type SkillsArenaState } from "./skills-arena";
import { findZappySourceChapter, isExactDikshaBookId, loadZappySourceBook, normaliseSourceTitle, questProgressStorageKey, sourceKindIcon, zappyMediaUrl, ZAPPY_QUEST_STAGES, type ZappySourceBook, type ZappySourceChapter, type ZappySourceResource } from "./zappy-source";
import { TeacherPrepCopilot, TeacherPrepLaunchCard } from "./teacher-prep-copilot";
import { KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK, KARNATAKA_CLASS_8_SCIENCE_SOURCE, KARNATAKA_CLASS_8_SCIENCE_UNITS } from "./karnataka-class8-science";
import { ParentLearningDiary, StudentAssignmentInbox, TeacherLearningProofSummary } from "./learning-proof-ui";
import { RoleAIPulse } from "./zappy-pulse-ui";

type View = "learn" | "games" | "arena" | "league" | "profile";
type Role = "child" | "teacher" | "parent";
type Modal = "lesson" | "ai" | "notebook" | "reward" | "questions" | "features" | "mirror" | "shop" | null;
type GameTheme = "Builder"|"Grower"|"Mixer"|"Explorer"|"Calculator City"|"Story Forge"|"Lab";
type GameContext={board:string;grade:string;subject:string;chapter:string;book:string;source:string};
type StudyContext={board:string;grade:string;subject:string;chapter:string;bookId?:string;book?:string;source?:string;chapters?:string[]};
type StudentQuestReceipt={id:string;actorId:string;tenant:string;dayKey:string;bookId:string;chapter:string;confidence:LoopConfidence};
type ArenaEntryScope=CompetitionScope|"training";
type ArenaMirrorResult={skill:ArenaSkill;overallScore:number|null;signals:MeasuredSignals;attemptKey:string};
const CBSE8_SCIENCE_TEXTBOOK={book:"(NEW) Science Textbook for Class VIII",source:"https://diksha.gov.in/play/collection/do_31310347515623014411296"};
const DEFAULT_GAME_CONTEXT:GameContext={board:"CBSE",grade:"Class 8",subject:"Science",chapter:"FORCE AND PRESSURE",...CBSE8_SCIENCE_TEXTBOOK};

const games = [
  { icon: "🌉", title: "Builder", text: "Build it. Test it. Watch physics decide.", color: "blue" },
  { icon: "🌱", title: "Grower", text: "Nurture a world through every life stage.", color: "green" },
  { icon: "⚗️", title: "Mixer", text: "Predict, combine, and see what happens.", color: "purple" },
  { icon: "🪐", title: "Explorer", text: "Navigate worlds, history, and space.", color: "orange" },
  { icon: "🏙️", title: "Calculator City", text: "Grow a city with every right answer.", color: "cyan" },
  { icon: "📖", title: "Story Forge", text: "Repair stories and power up your words.", color: "pink" },
  { icon: "🔬", title: "Lab", text: "Think like a scientist, not a textbook.", color: "yellow" },
];

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<Role>("child");
  const [loginRole, setLoginRole] = useState<Role>("child");
  const [accountOpen, setAccountOpen] = useState(false);
  const [tenant, setTenant] = useState("Personal");
  const [view, setView] = useState<View>("learn");
  const [modal, setModal] = useState<Modal>(null);
  const [gameTheme,setGameTheme]=useState<GameTheme>("Builder");
  const [gameContext,setGameContext]=useState<GameContext>(DEFAULT_GAME_CONTEXT);
  const [xp, setXp] = useState(1240);
  const [coins, setCoins] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [dailyContext,setDailyContext]=useState<StudyContext|null>(null);
  const [arenaSkillId,setArenaSkillId]=useState<ArenaSkill>("public");
  const [arenaEntryScope,setArenaEntryScope]=useState<ArenaEntryScope>("training");
  const [arenaRevision,setArenaRevision]=useState(0);
  const [teacherOutcomeRequest,setTeacherOutcomeRequest]=useState<{id:string;needsReview:boolean;strong:boolean}|null>(null);
  const [studentQuestReceipt,setStudentQuestReceipt]=useState<StudentQuestReceipt|null>(null);

  const identities = {
    child: { name: "Arjun Sharma", id: "@arjun_zappy", avatar: "👦", label: "Child learner" },
    teacher: { name: "Ms. Sharma", id: "@mssharma_zappy", avatar: "👩‍🏫", label: "Teacher" },
    parent: { name: "Priya Sharma", id: "@priya_zappy", avatar: "👩", label: "Parent" },
  };
  const current = identities[role];
  const linkedChildren: Record<string, { name: string; id: string }> = {
    Arjun: { name: "Arjun", id: "@arjun_zappy" },
    Anaya: { name: "Anaya", id: "@anaya_zappy" },
  };
  const selectedChild = linkedChildren[tenant] || linkedChildren.Arjun;
  const roleTenants = {
    child: ["Personal", "Class 4-A", "Science Squad"],
    teacher: ["Delhi Public School", "Bright Future Academy", "Independent"],
    parent: ["Arjun", "Anaya"],
  };

  useEffect(() => {
    if (!signedIn) return;
    const key = "zappy:shop-coins:v1:" + encodeURIComponent(current.id.toLowerCase());
    queueMicrotask(() => {
      const saved = Number(window.localStorage.getItem(key) || "0");
      setCoins(Number.isInteger(saved) && saved >= 0 ? saved : 0);
    });
  }, [signedIn, current.id]);

  function changeCoins(amount: number, rewardId?: string) {
    const key = "zappy:shop-coins:v1:" + encodeURIComponent(current.id.toLowerCase());
    const ledgerKey = "zappy:shop-reward-ledger:v1:" + encodeURIComponent(current.id.toLowerCase());
    const previousLedger = window.localStorage.getItem(ledgerKey);
    let ledger: string[] = [];
    try {
      const parsed = JSON.parse(previousLedger || "[]");
      ledger = Array.isArray(parsed) ? parsed.filter(item => typeof item === "string").slice(-500) : [];
    } catch {
      ledger = [];
    }
    if (rewardId && ledger.includes(rewardId)) return;
    const saved = Number(window.localStorage.getItem(key) || String(coins));
    const next = Math.max(0, (Number.isFinite(saved) ? saved : coins) + amount);
    const previousBalance = window.localStorage.getItem(key);
    try {
      window.localStorage.setItem(key, String(next));
      if (rewardId) window.localStorage.setItem(ledgerKey, JSON.stringify([...ledger, rewardId].slice(-500)));
      setCoins(next);
    } catch {
      try {
        if (previousBalance === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, previousBalance);
        if (previousLedger === null) window.localStorage.removeItem(ledgerKey);
        else window.localStorage.setItem(ledgerKey, previousLedger);
      } catch {
        // The visible balance remains unchanged if browser storage cannot commit the ledger.
      }
    }
  }

  const title = useMemo(() => ({
    learn: "Today’s daily learning loop",
    games: "Choose your game engine",
    arena: "Real-life skills arena",
    league: "Emerald League",
    profile: "Your Zappy journey",
  }[view]), [view]);

  function signIn() {
    setRole(loginRole);
    setTenant(roleTenants[loginRole][0]);
    setSignedIn(true);
    setView("learn");
    setDailyContext(null);
    setStudentQuestReceipt(null);
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setTenant(roleTenants[nextRole][0]);
    setView("learn");
    setAccountOpen(false);
    setDailyContext(null);
    setStudentQuestReceipt(null);
  }

  function openArena(skill:ArenaSkill,scope:ArenaEntryScope){
    setArenaSkillId(skill);
    setArenaEntryScope(scope);
    setModal("mirror");
  }

  function saveArenaAttempt(result:ArenaMirrorResult){
    const key=skillsArenaStorageKey(current.id,tenant);
    const state=parseSkillsArenaState(window.localStorage.getItem(key),{actorId:current.id,tenant})||createSkillsArenaState({actorId:current.id,tenant});
    const weekKey=arenaWeekKey();
    const competition=arenaEntryScope!=="training";
    const scope:CompetitionScope=arenaEntryScope==="training"?"class":arenaEntryScope;
    const createdAt=new Date().toISOString();
    const recorded=recordSkillAttempt(state,{
      id:buildSkillAttemptId({actorId:current.id,tenant,skill:result.skill,weekKey,challengeId:competition?`${weekKey}-${result.skill}-${scope}`:`${result.skill}-baseline`,scope,clientAttemptKey:result.attemptKey}),
      skill:result.skill,
      challengeId:competition?`${weekKey}-${result.skill}-${scope}`:`${result.skill}-baseline`,
      weekKey,
      scope,
      createdAt,
      overallScore:result.overallScore,
      signals:result.signals,
      reviewMode:"measured",
      roundType:competition?"competition":"baseline",
      submitForRanking:competition,
    });
    if(recorded.ok){
      window.localStorage.setItem(key,serializeSkillsArenaState(recorded.state));
      setArenaRevision(value=>value+1);
    }
    return recorded.reason;
  }

  if (!signedIn) {
    return <LoginScreen role={loginRole} setRole={setLoginRole} onLogin={signIn} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("learn")} aria-label="Zappy home">
          <span className="bolt">ϟ</span><span>ZAPPY</span>
        </button>
        <div className="workspace-switcher">
          <small>{role === "teacher" ? "SCHOOL / WORKSPACE" : role === "parent" ? "VIEWING CHILD" : "LEARNING SPACE"}</small>
          <select value={tenant} onChange={(e) => { setTenant(e.target.value); setDailyContext(null); setStudentQuestReceipt(null); }} aria-label="Current workspace">
            {roleTenants[role].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <nav aria-label="Main navigation">
          <Nav icon="🔁" label="Daily Loop" active={view === "learn"} onClick={() => setView("learn")} />
          <Nav icon={role === "teacher" ? "📋" : role === "parent" ? "✍️" : "🎮"} label={role === "teacher" ? "Assignments" : role === "parent" ? "Practice Packs" : "Games"} active={view === "games"} onClick={() => setView("games")} />
          <Nav icon={role === "child" ? "🎤" : "👥"} label={role === "child" ? "Skills Arena" : role === "teacher" ? "Classes" : "Children"} active={view === "arena"} onClick={() => setView("arena")} />
          <Nav icon={role === "child" ? "🛡️" : "📈"} label={role === "child" ? "Leagues" : "Analytics"} active={view === "league"} onClick={() => setView("league")} />
          <Nav icon="👦" label="Profile" active={view === "profile"} onClick={() => setView("profile")} />
        </nav>
        <button className="ai-side" onClick={() => setModal("ai")}>
          <Mascot small />
          <span><b>Zappy AI</b><small>{role==="teacher"?"Daily class copilot":role==="parent"?"Family learning guide":"Your study buddy"}</small></span>
          <i>●</i>
        </button>
      </aside>

      <section className="page">
        <header className="topbar">
          <div className="mobile-brand"><span className="bolt">ϟ</span>ZAPPY</div>
          <button className="notebook-top" onClick={() => setModal("notebook")}><span>📓</span><b>{role==="teacher"?"Class source":"Zappy Quest"}</b></button>
          <button className="predictor-top" onClick={() => setModal("questions")}><span>🎯</span><b>{role==="teacher"?"Exam evidence":"Exam Predictor"}</b></button>
          {role!=="teacher"&&<button className="features-top" onClick={() => setModal("features")}><span>▦</span><b>All Features</b></button>}
          {role!=="teacher"&&!(role==="child"&&view==="learn")&&<button title="Current streak"><span>🔥</span><b>14</b></button>}
          {role!=="teacher"&&!(role==="child"&&view==="learn")&&<button title="Gems"><span>💎</span><b>72</b></button>}
          {role!=="teacher"&&<button title="Open Stationery Boutique" onClick={()=>setModal("shop")}><span>🪙</span><b>{coins}</b></button>}
          <div className="account-wrap">
            <button className="account-button" onClick={() => setAccountOpen(!accountOpen)} title="Account menu">
              <span>{current.avatar}</span><div><b>{current.name}</b><small>{current.id}</small></div><i>⌄</i>
            </button>
            {accountOpen && <div className="account-menu">
              <div className="account-summary"><span>{current.avatar}</span><div><b>{current.name}</b><small>{current.id}</small></div></div>
              <p>SWITCH EXPERIENCE</p>
              {(["child","teacher","parent"] as Role[]).map((r) => <button className={r === role ? "selected-role" : ""} key={r} onClick={() => switchRole(r)}><span>{identities[r].avatar}</span><div><b>{identities[r].label}</b><small>{identities[r].id}</small></div>{r === role && <i>✓</i>}</button>)}
              <button className="logout-button" onClick={() => { setSignedIn(false); setAccountOpen(false); }}>↪ <b>Log out</b></button>
            </div>}
          </div>
        </header>

        <div className={`content ${role==="teacher"&&view==="learn"?"teacher-home-content":""}`}>
          <div className={`main-column ${role==="teacher"&&view==="learn"?"teacher-home-main":""}`}>
            <div className="eyebrow">{role === "child" ? dailyContext ? `${dailyContext.grade} · ${dailyContext.board} · ${dailyContext.subject}`.toUpperCase() : "BUILD YOUR LEARNING PATH" : role === "teacher" ? tenant.toUpperCase() + " · TEACHER CONSOLE" : tenant.toUpperCase() + " · PARENT VIEW"}</div>
            <h1>{role === "child" ? title : role === "teacher" ? ["Today’s daily teaching loop","Assignment studio","Your classes","Learning analytics","Teacher profile"][["learn","games","arena","league","profile"].indexOf(view)] : ["Today’s daily family loop","Create practice pack","Linked children","Progress & insights","Parent profile"][["learn","games","arena","league","profile"].indexOf(view)]}</h1>
            {role==="teacher"&&view==="learn"&&<>
              <p className="teacher-home-lead">One sourced class plan for today. Prepare it, teach it, record what happened—then the loop stops.</p>
              <TeacherPrepLaunchCard teacherName={current.name} tenant={tenant} context={dailyContext} onOpen={()=>setModal("ai")} onSetStage={()=>document.getElementById("teacher-daily-loop")?.scrollIntoView({behavior:"smooth",block:"start"})}/>
            </>}
            {view==="learn"&&<DailyLearningLoop key={`${role}-${tenant}`} role={role} actorId={current.id} tenant={tenant} completionRequest={role==="teacher"?teacherOutcomeRequest:null} studentQuestReceipt={role==="child"?studentQuestReceipt:null} onContextChange={setDailyContext} onStudy={context=>{setDailyContext(context);setModal("notebook")}}/>}
            {role==="teacher"&&view==="learn"&&<>
              <RoleAIPulse role="teacher" context={dailyContext} onPrimary={()=>dailyContext?setModal("ai"):document.getElementById("teacher-daily-loop")?.scrollIntoView({behavior:"smooth",block:"start"})} onSecondary={()=>dailyContext?setModal("questions"):document.getElementById("teacher-daily-loop")?.scrollIntoView({behavior:"smooth",block:"start"})}/>
              <TeacherLearningProofSummary key={`${current.id}-${tenant}`} actorId={current.id} workspace={tenant} onOpen={()=>setModal("ai")}/>
            </>}
            {role === "child" && view === "learn" && <RoleAIPulse
              role="child"
              context={dailyContext}
              onPrimary={()=>dailyContext?setModal("notebook"):document.querySelector(".student-daily-path,.daily-loop-shell")?.scrollIntoView({behavior:"smooth",block:"start"})}
              onSecondary={()=>document.getElementById("teacher-side-quests")?.scrollIntoView({behavior:"smooth",block:"start"})}
            />}
            {role === "child" && view === "learn" && <StudentAssignmentInbox actorId={current.id} studentName={current.name} onCoinsEarned={changeCoins} />}
            {role === "child" && view === "games" && <GamesView onPlay={(theme,context)=>{setGameTheme(theme);setGameContext(context);setModal("lesson")}} />}
            {role === "child" && view === "arena" && <ArenaView key={`${current.id}-${tenant}`} actorId={current.id} tenant={tenant} revision={arenaRevision} skillId={arenaSkillId} onSelectSkill={setArenaSkillId} onOpen={openArena} />}
            {role === "child" && view === "league" && <LeagueView xp={xp} />}
            {role === "child" && view === "profile" && <ProfileView xp={xp} onShop={()=>setModal("shop")} />}
            {role === "teacher" && view!=="learn" && <TeacherView view={view} tenant={tenant} actorId={current.id} setModal={setModal} />}
            {role === "parent" && <ParentView view={view} parentId={current.id} parentName={current.name} child={selectedChild} setModal={setModal} />}
          </div>

          {role === "child" ? <aside className="right-column">
            <div className="daily-card">
              <div className="daily-top">
                <div><span className="tiny-label">DAILY LOOP</span><h3>One sourced step</h3></div>
                <span className="chest">🧭</span>
              </div>
              <p>Your exact book, today’s chapter and next step are shown in the learning feed.</p>
              <div className="progress"><i style={{ width: "100%" }} /></div>
              <div className="progress-row"><b>FINITE PLAN</b><span>DONE HAS AN EXIT</span></div>
            </div>
            {view!=="learn"&&<div className="streak-card">
              <div className="streak-head"><span>🔥</span><div><b>14 day streak</b><small>Personal best: 21</small></div></div>
              <div className="week">
                {["M","T","W","T","F","S","S"].map((d, i) => <div key={i}><span className={i < 6 ? "hot" : ""}>{i < 6 ? "✓" : "·"}</span><small>{d}</small></div>)}
              </div>
            </div>}
            {view!=="learn"&&<div className="rank-card">
              <span className="shield">🛡️</span>
              <div><small>EMERALD LEAGUE</small><b>You’re #4</b><p>Top 3 promote in 2d 8h</p></div>
              <button onClick={() => setView("league")}>VIEW</button>
            </div>}
            <button className="predictor-card" onClick={() => setModal("questions")}>
              <span>🎯</span><div><small>IMPORTANT QUESTIONS WORKSPACE</small><b>Connect 5+ verified papers</b><em>Predictions stay locked without evidence →</em></div>
            </button>
            {view!=="learn"&&<button className={`reward-card ${claimed ? "claimed" : ""}`} onClick={() => !claimed && setModal("reward")}>
              <span>{claimed ? "✓" : "⚡"}</span>
              <div><b>{claimed ? "Reward claimed!" : "Your streak reward is ready!"}</b><small>{claimed ? "+20 coins added" : "Tap to open today’s surprise"}</small></div>
            </button>}
            <button className="stationery-mini-card" onClick={()=>setModal("shop")}><span>🎒</span><div><small>NEW · ZAPPY BOUTIQUE</small><b>Designer bags & fancy stationery</b><em>Personalise with your Zappy ID →</em></div></button>
          </aside> : role==="teacher"&&view==="learn" ? null : <aside className="right-column role-side">
            <div className="ai-role-card"><Mascot small/><div><span className="tiny-label">ZAPPY AI</span><h3>{role === "teacher" ? "Daily teaching copilot" : "Daily family learning guide"}</h3><p>{role === "teacher" ? "Select the exact class stage once. I’ll prepare one sourced next step each day." : "Select your child’s exact stage once. I’ll suggest one clear way to help each day."}</p><button onClick={() => setModal("ai")}>OPEN SOURCED AI</button></div></div>
            <div className="tenant-card"><span>{role === "teacher" ? "🏫" : "👨‍👩‍👧"}</span><div><small>CURRENT {role === "teacher" ? "WORKSPACE" : "CHILD"}</small><b>{tenant}</b><p>{role === "teacher" ? dailyContext?`${dailyContext.grade} · ${dailyContext.subject}`:"Exact class stage not set" : `${selectedChild.id} · same-browser link`}</p></div></div>
            <button className="predictor-card" onClick={() => setModal("questions")}><span>🎯</span><div><small>EXAM EVIDENCE</small><b>{role === "teacher" ? "Import verified past papers" : "Review verified paper coverage"}</b><em>Open evidence gate →</em></div></button>
            <div className="security-card"><span>🧪</span><div><b>Local prototype boundaries</b><small>Records are organized by role, Zappy ID, workspace, and class on this browser. Roles remain freely switchable because production authentication is not connected yet.</small></div></div>
          </aside>}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Nav icon="🔁" label="Daily Loop" active={view === "learn"} onClick={() => setView("learn")} />
        <Nav icon={role === "child" ? "🎮" : "📋"} label={role === "child" ? "Games" : "Tasks"} active={view === "games"} onClick={() => setView("games")} />
        <button className="mobile-ai" onClick={() => setModal("ai")}>ϟ</button>
        <Nav icon={role === "child" ? "🛡️" : "📈"} label={role === "child" ? "League" : "Insights"} active={view === "league"} onClick={() => setView("league")} />
        <Nav icon={current.avatar} label="Profile" active={view === "profile"} onClick={() => setView("profile")} />
      </nav>

      {modal === "lesson" && (
        <EndlessGameLoop key={`${current.id}-${gameTheme}-${gameContext.board}-${gameContext.grade}-${gameContext.subject}-${gameContext.chapter}`} playerId={current.id} theme={gameTheme} context={gameContext} onClose={()=>setModal(null)} onReward={(earnedXp,earnedCoins)=>{setXp(value=>value+earnedXp);changeCoins(earnedCoins)}}/>
      )}

      {modal === "ai" && (role==="teacher"
        ? <TeacherPrepCopilot actorId={current.id} teacherName={current.name} tenant={tenant} context={dailyContext} onOpenSource={()=>setModal("notebook")} onOpenEvidence={()=>setModal("questions")} onLessonOutcome={(outcome,confidence)=>setTeacherOutcomeRequest({id:String(Date.now()),needsReview:outcome!=="taught"||confidence==="needs-review",strong:outcome==="taught"&&confidence==="strong"})} onClose={()=>setModal(null)}/>
        : <ZappyLessonQuest role={role} actorId={current.id} tenant={tenant} initialContext={dailyContext} onComplete={role==="child"?setStudentQuestReceipt:undefined} onClose={() => setModal(null)} />
      )}
      {modal === "notebook" && <ZappyLessonQuest role={role} actorId={current.id} tenant={tenant} initialContext={dailyContext} onComplete={role==="child"?setStudentQuestReceipt:undefined} onClose={() => setModal(null)} />}

      {modal === "reward" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Daily reward">
          <div className="reward-modal">
            <button className="close-x" onClick={() => setModal(null)}>×</button>
            <div className="reward-burst">✦<span>🎁</span>✦</div>
            <div className="tiny-label">14 DAY STREAK REWARD</div>
            <h2>You found 20 coins!</h2>
            <p>Keep the fire alive. Tomorrow’s reward is even bigger.</p>
            <button className="primary-btn" onClick={() => { setClaimed(true); changeCoins(20); setModal(null); }}>CLAIM REWARD</button>
          </div>
        </div>
      )}
      {modal === "questions" && <ImportantQuestionsPredictor role={role} onClose={() => setModal(null)} onStudy={() => setModal("notebook")} />}
      {modal === "features" && <FeatureHub role={role} onClose={() => setModal(null)} onQuestions={() => setModal("questions")} onStudy={() => setModal("notebook")} />}
      {modal === "mirror" && <SkillMirrorStudio key={`${current.id}-${tenant}-${arenaSkillId}-${arenaEntryScope}`} initialSkillId={arenaSkillId} entryScope={arenaEntryScope} onComplete={saveArenaAttempt} onClose={() => setModal(null)} />}
      {modal === "shop" && <StationeryBoutique coins={coins} onSpend={(amount)=>changeCoins(-amount)} onClose={()=>setModal(null)} />}
    </main>
  );
}

type CurriculumBookSequence={
  id:string;
  board:string;
  grades:string[];
  subjects:string[];
  name:string;
  mediums:string[];
  edition:string;
  source:string;
  chapters:string[];
};
const SEQUENCE_SLUGS:Record<string,string>={
  "CBSE":"cbse",
  "Karnataka State Board":"karnataka-state-board",
  "Kerala State Board":"kerala-state-board",
  "Tamil Nadu State Board":"tamil-nadu-state-board",
  "Telangana State Board":"telangana-state-board",
};
const sequenceCache=new Map<string,Promise<CurriculumBookSequence[]>>();
const KARNATAKA_CLASS_8_SCIENCE_OFFICIAL_SEQUENCE:CurriculumBookSequence={
  id:"official:dsert:karnataka:class8:science:2025-26",
  board:"Karnataka State Board",
  grades:["Class 8"],
  subjects:["Science"],
  name:"Official 2025–26 DSERT Science LBA · English",
  mediums:["English"],
  edition:"2025-26 · 2026-27 verification pending",
  source:KARNATAKA_CLASS_8_SCIENCE_SOURCE.pdfUrl,
  chapters:KARNATAKA_CLASS_8_SCIENCE_UNITS.map(unit=>unit.title),
};
function curriculumChapterMatchKey(value:string){
  const key=normaliseSourceTitle(value);
  if(key==="some natural phenomena")return "natural phenomena";
  if(key==="reaching the age of adolescence"||key==="reaching of adoloscence")return "reaching adolescence";
  if(key==="micro organismsfriend and foe"||key==="micro organisms friend and foe")return "micro organisms friend and foe";
  return key;
}
function exactCurriculumChapterIndex(chapters:string[],title:string){
  const key=curriculumChapterMatchKey(title);
  return chapters.findIndex(chapter=>curriculumChapterMatchKey(chapter)===key);
}
function sourceFingerprint(sequence:CurriculumBookSequence){
  let chapterHash=2166136261;
  for(const character of sequence.chapters.join("\u241f")){
    chapterHash^=character.charCodeAt(0);
    chapterHash=Math.imul(chapterHash,16777619);
  }
  return `${sequence.id}:${sequence.edition}:${sequence.source}:${sequence.chapters.length}:${chapterHash>>>0}`;
}
function sequencePriority(sequence:CurriculumBookSequence,subject:string){
  const text=`${sequence.name} ${sequence.mediums.join(" ")}`.toLowerCase();
  let score=0;
  if(text.includes("english"))score+=30;
  if(text.includes(subject.toLowerCase()))score+=25;
  if(text.includes("textbook"))score+=20;
  if(/question|comic|workbook|manual|experiment|exemplar|lab/.test(text))score-=80;
  if(sequence.id===KARNATAKA_CLASS_8_SCIENCE_OFFICIAL_SEQUENCE.id)score+=1000;
  if(sequence.id===KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK.bookId)score-=100;
  return score;
}
async function loadCurriculumBookSequences(board:string,grade:string,subject:string,preferCurrentOfficial=false){
  const slug=SEQUENCE_SLUGS[board];
  if(!slug)return [];
  if(!sequenceCache.has(slug)){
    sequenceCache.set(slug,fetch(`/curriculum-sequences/${slug}.json`)
      .then(response=>{if(!response.ok)throw new Error("Curriculum sequence file unavailable");return response.json()})
      .then((data:{books:CurriculumBookSequence[]})=>data.books));
  }
  const books=await sequenceCache.get(slug)!;
  const matches=books
    .filter(book=>book.grades.includes(grade)&&book.subjects.includes(subject)&&book.chapters.length)
  if(preferCurrentOfficial&&board==="Karnataka State Board"&&grade==="Class 8"&&subject.toLowerCase()==="science"){
    matches.push(KARNATAKA_CLASS_8_SCIENCE_OFFICIAL_SEQUENCE);
  }
  return matches.sort((a,b)=>sequencePriority(b,subject)-sequencePriority(a,subject)||a.name.localeCompare(b.name));
}
function frameworkSequence(board:string,grade:string,subject:string){
  const curriculum=curriculumFor(board,grade,subject);
  if(!curriculum||curriculum.coverage==="textbook-catalogue"||!curriculum.chapters.length)return null;
  return {
    id:`${curriculum.coverage}:${board}:${grade}:${subject}`,
    board,
    grades:[grade],
    subjects:[subject],
    name:curriculum.book,
    mediums:curriculum.books[0]?.mediums||[],
    edition:curriculum.edition,
    source:curriculum.source,
    chapters:curriculum.chapters,
  } satisfies CurriculumBookSequence;
}

function studentPathReceiptStorageKey(actorId:string,tenant:string,dayKey:string,sequence:CurriculumBookSequence,chapterIndex:number){
  return `zappy:student-path-receipt:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(tenant)}:${dayKey}:${encodeURIComponent(sourceFingerprint(sequence))}:${chapterIndex}`;
}

function DailyLearningLoop({role,actorId,tenant,completionRequest,studentQuestReceipt,onStudy,onContextChange}:{role:Role;actorId:string;tenant:string;completionRequest:{id:string;needsReview:boolean;strong:boolean}|null;studentQuestReceipt:StudentQuestReceipt|null;onStudy:(context:StudyContext)=>void;onContextChange:(context:StudyContext|null)=>void}){
  const [loop,setLoop]=useState<DailyLoopState|null>(null);
  const [activeSequence,setActiveSequence]=useState<CurriculumBookSequence|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [editing,setEditing]=useState(false);
  const [confidence,setConfidence]=useState<LoopConfidence|null>(null);
  const [status,setStatus]=useState("");
  const [draftBoard,setDraftBoard]=useState(role==="teacher"?"Karnataka State Board":"CBSE");
  const [draftGrade,setDraftGrade]=useState("Class 8");
  const [draftSubject,setDraftSubject]=useState("Science");
  const [draftBookId,setDraftBookId]=useState("");
  const requestedDraftBookId=useRef("");
  const [draftChapterIndex,setDraftChapterIndex]=useState(0);
  const [draftMinutes,setDraftMinutes]=useState<8|15|25|40>(15);
  const [draftSequences,setDraftSequences]=useState<CurriculumBookSequence[]>([]);
  const [sequencesLoading,setSequencesLoading]=useState(false);
  const [draftSourceGate,setDraftSourceGate]=useState<"idle"|"checking"|"ready"|"blocked">("idle");
  const [draftSourceGateKey,setDraftSourceGateKey]=useState("");
  const [draftSourceGateMessage,setDraftSourceGateMessage]=useState("Choose an exact book to check its playable source.");
  const [studentSetupStep,setStudentSetupStep]=useState<0|1|2|3>(0);
  const [studentMapStep,setStudentMapStep]=useState<"lesson"|"reflect"|"finish"|"next">("lesson");
  const [questReceipt,setQuestReceipt]=useState<StudentQuestReceipt|null>(null);
  const studentActiveNodeRef=useRef<HTMLButtonElement|null>(null);
  const shouldFocusStudentNode=useRef(false);
  const processedCompletionRequest=useRef("");
  const storageKey=`zappy:daily-loop:v1:${role}:${encodeURIComponent(actorId)}:${encodeURIComponent(tenant)}`;
  const dailyLoopId=`${role}-daily-loop`;
  const today=localDayKey();
  const draftImportedSubjects=curriculumSubjects(draftBoard,draftGrade);
  const draftSubjects=draftImportedSubjects.length?draftImportedSubjects:(BOARD_SUBJECTS[draftBoard]||[]);
  const draftCurriculum=curriculumFor(draftBoard,draftGrade,draftSubject);
  const selectedDraftSequence=draftSequences.find(sequence=>sequence.id===draftBookId)||null;
  const draftSequenceId=selectedDraftSequence?.id||"";
  const draftChapterTitle=selectedDraftSequence?.chapters[draftChapterIndex]||"";
  const draftSourceSelectionKey=`${draftSequenceId}:${draftChapterTitle}`;
  const draftSequencePlayable=draftSourceGate==="ready"&&draftSourceGateKey===draftSourceSelectionKey;
  const questReceiptKey=role==="child"&&loop&&activeSequence?studentPathReceiptStorageKey(actorId,tenant,loop.dayKey,activeSequence,loop.chapterIndex):"";
  const roleGuide={
    child:{icon:"⚡",eyebrow:"YOUR DAILY LEARNING FEED",title:"One focused loop. Then you’re done.",today:"Learn this today",open:"PLAY TODAY’S ZAPPY QUEST →",complete:"FINISH TODAY’S LOOP",done:"Done for today",flow:["Learn from the cited source","Recall the key idea","Explain it in your own words"],notification:"Your next sourced lesson is ready"},
    teacher:{icon:"🦉",eyebrow:"TODAY’S TEACHING LOOP",title:"One class. One clear next step.",today:"Teach this today",open:"OPEN TODAY’S CLASS SOURCE →",complete:"MARK TODAY’S CLASS COMPLETE",done:"Today’s class loop is complete",flow:["Prepare from the cited source","Teach the selected portion","Record class confidence"],notification:"Your next sourced class plan is ready"},
    parent:{icon:"💙",eyebrow:"YOUR DAILY FAMILY FEED",title:"One clear way to help—without becoming the teacher.",today:"Support this today",open:"OPEN TODAY’S SOURCE →",complete:"MARK TODAY’S SUPPORT COMPLETE",done:"Family support is done for today",flow:["Understand the source simply","Ask one supportive question","Record how it felt"],notification:"Today’s family learning support is ready"},
  }[role];

  function contextFrom(state:DailyLoopState,sequence:CurriculumBookSequence):StudyContext{
    return {board:state.board,grade:state.grade,subject:state.subject,chapter:sequence.chapters[state.chapterIndex]||"",bookId:sequence.id,book:sequence.name,source:sequence.source,chapters:sequence.chapters};
  }
  function persist(next:DailyLoopState,sequence=activeSequence){
    setLoop(next);
    window.localStorage.setItem(storageKey,JSON.stringify(next));
    if(sequence)onContextChange(contextFrom(next,sequence));
  }
  function prepareDraftFrom(state:DailyLoopState){
    setDraftBoard(state.board);setDraftGrade(state.grade);setDraftSubject(state.subject);
    requestedDraftBookId.current=state.bookId;setDraftBookId(state.bookId);setDraftChapterIndex(state.chapterIndex);setDraftMinutes(state.sessionMinutes);
  }
  function chooseDraftBook(nextBookId:string){
    requestedDraftBookId.current=nextBookId;setDraftBookId(nextBookId);setDraftChapterIndex(0);
  }

  useEffect(()=>{
    let active=true;
    const sourceController=new AbortController();
    const saved=parseDailyLoopState(window.localStorage.getItem(storageKey));
    if(!saved){queueMicrotask(()=>{if(active)setLoaded(true)});return()=>{active=false;sourceController.abort()}}
    const curriculum=curriculumFor(saved.board,saved.grade,saved.subject);
    const sequencePromise=curriculum?.coverage==="textbook-catalogue"
      ? loadCurriculumBookSequences(saved.board,saved.grade,saved.subject,role==="teacher").then(items=>{
        let sequence=items.find(item=>item.id===saved.bookId)||null;
        let state=saved;
        let migrated=false;
        if(role==="teacher"&&saved.bookId===KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK.bookId){
          const legacy=sequence;
          const official=items.find(item=>item.id===KARNATAKA_CLASS_8_SCIENCE_OFFICIAL_SEQUENCE.id)||null;
          const currentTitle=legacy?.chapters[saved.chapterIndex]||"";
          const migratedIndex=official?exactCurriculumChapterIndex(official.chapters,currentTitle):-1;
          if(legacy&&official&&migratedIndex>=0){
            const nextTitle=legacy.chapters[saved.nextChapterIndex]||currentTitle;
            const nextIndex=exactCurriculumChapterIndex(official.chapters,nextTitle);
            state={
              ...saved,
              bookId:official.id,
              bookName:official.name,
              sourceFingerprint:sourceFingerprint(official),
              chapterIndex:migratedIndex,
              nextChapterIndex:nextIndex>=0?nextIndex:migratedIndex,
              history:saved.history.flatMap(entry=>{
                const index=exactCurriculumChapterIndex(official.chapters,entry.chapter);
                return index>=0?[{...entry,chapterIndex:index,chapter:official.chapters[index]}]:[];
              }),
            };
            sequence=official;
            migrated=true;
          }
        }
        return {sequence,state,migrated};
      })
      : Promise.resolve({sequence:frameworkSequence(saved.board,saved.grade,saved.subject),state:saved,migrated:false});
    sequencePromise.then(async ({sequence,state,migrated})=>{
      if(!active)return;
      if(!sequence||sourceFingerprint(sequence)!==state.sourceFingerprint||state.chapterIndex<0||state.chapterIndex>=sequence.chapters.length){
        setStatus("The saved book or edition changed. Please confirm the current learning stage again.");
        setEditing(true);setLoaded(true);onContextChange(null);return;
      }
      const rolled=rollDailyLoop(state,localDayKey(),sequence.chapters.length);
      if(role==="child"&&!isExactDikshaBookId(sequence.id)){
        prepareDraftFrom(rolled);
        setStatus("This saved trail has an exact chapter order, but its playable in-Zappy source adapter is not connected. Choose a source-ready book to continue.");
        setEditing(true);setLoaded(true);onContextChange(null);return;
      }
      if(role==="child"){
        try{
          const sourceBook=await loadZappySourceBook(sequence.id,sourceController.signal);
          if(!active)return;
          const sourceChapter=findZappySourceChapter(sourceBook,sequence.chapters[rolled.chapterIndex])||null;
          if(!sourceChapter||!sourceChapter.resources.length){
            prepareDraftFrom(rolled);
            setStatus(sourceChapter?"This saved chapter has no allowlisted resource playable inside Zappy yet. Choose another source-ready chapter.":"This saved chapter no longer matches the current Live book edition. Confirm a source-ready chapter.");
            setEditing(true);setLoaded(true);onContextChange(null);return;
          }
        }catch(error){
          if(!active||error instanceof DOMException&&error.name==="AbortError")return;
          prepareDraftFrom(rolled);setStatus(error instanceof Error?error.message:"The saved source could not be verified.");setEditing(true);setLoaded(true);onContextChange(null);return;
        }
      }
      setActiveSequence(sequence);setLoop(rolled);prepareDraftFrom(rolled);setConfidence(rolled.lastConfidence);setStudentMapStep(rolled.completedToday?"next":"lesson");
      window.localStorage.setItem(storageKey,JSON.stringify(rolled));
      if(migrated)setStatus("Updated to the official 2025–26 DSERT 13-unit sequence. 2026–27 verification remains pending.");
      onContextChange(contextFrom(rolled,sequence));setLoaded(true);
    }).catch(()=>{
      if(!active)return;
      setStatus("The exact book sequence could not be loaded. Recommendations remain paused.");
      setEditing(true);setLoaded(true);onContextChange(null);
    });
    return()=>{active=false;sourceController.abort()};
  },[storageKey,onContextChange,role]);

  useEffect(()=>{
    if(role!=="child"||!loop||!activeSequence||!questReceiptKey)return;
    let restored:StudentQuestReceipt|null=null;
    try{
      const parsed=JSON.parse(window.localStorage.getItem(questReceiptKey)||"null") as Partial<StudentQuestReceipt>|null;
      const currentChapter=activeSequence.chapters[loop.chapterIndex]||"";
      if(parsed&&parsed.actorId===actorId&&parsed.tenant===tenant&&parsed.dayKey===loop.dayKey&&parsed.bookId===activeSequence.id&&parsed.chapter===currentChapter&&(parsed.confidence==="needs-help"||parsed.confidence==="steady"||parsed.confidence==="mastered"))restored=parsed as StudentQuestReceipt;
    }catch{restored=null}
    queueMicrotask(()=>{
      setQuestReceipt(restored);
      if(restored){setConfidence(restored.confidence);setStudentMapStep(loop.completedToday?"next":"reflect")}
    });
  },[role,actorId,tenant,loop,activeSequence,questReceiptKey]);

  useEffect(()=>{
    if(role!=="child"||!studentQuestReceipt||!loop||!activeSequence||!questReceiptKey)return;
    const currentChapter=activeSequence.chapters[loop.chapterIndex]||"";
    if(studentQuestReceipt.actorId!==actorId||studentQuestReceipt.tenant!==tenant||studentQuestReceipt.dayKey!==loop.dayKey||studentQuestReceipt.bookId!==activeSequence.id||studentQuestReceipt.chapter!==currentChapter)return;
    queueMicrotask(()=>{
      setQuestReceipt(studentQuestReceipt);setConfidence(studentQuestReceipt.confidence);setStudentMapStep(loop.completedToday?"next":"reflect");
      window.localStorage.setItem(questReceiptKey,JSON.stringify(studentQuestReceipt));
    });
  },[role,actorId,tenant,studentQuestReceipt,loop,activeSequence,questReceiptKey]);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    if(role!=="child"){
      queueMicrotask(()=>{if(active){setDraftSourceGate("idle");setDraftSourceGateKey("");setDraftSourceGateMessage("Source playability is checked when a learner builds a path.")}});
      return()=>{active=false;controller.abort()};
    }
    if(!draftSequenceId||!draftChapterTitle){
      queueMicrotask(()=>{if(active){setDraftSourceGate("blocked");setDraftSourceGateKey("");setDraftSourceGateMessage("Choose an exact book and chapter before Zappy checks the player.")}});
      return()=>{active=false;controller.abort()};
    }
    if(!isExactDikshaBookId(draftSequenceId)){
      queueMicrotask(()=>{if(active){setDraftSourceGate("blocked");setDraftSourceGateKey("");setDraftSourceGateMessage("The chapter order is indexed, but this book’s in-Zappy player is not connected yet.")}});
      return()=>{active=false;controller.abort()};
    }
    queueMicrotask(()=>{if(active){setDraftSourceGate("checking");setDraftSourceGateKey("");setDraftSourceGateMessage("Loading the exact book, matching this chapter, and checking playable resources…")}});
    loadZappySourceBook(draftSequenceId,controller.signal).then(book=>{
      if(!active)return;
      const matched=findZappySourceChapter(book,draftChapterTitle)||null;
      if(!matched){setDraftSourceGate("blocked");setDraftSourceGateKey("");setDraftSourceGateMessage("This chapter no longer matches the current Live book edition. Choose another exact chapter.");return}
      if(!matched.resources.length){setDraftSourceGate("blocked");setDraftSourceGateKey("");setDraftSourceGateMessage("The exact chapter exists, but no allowlisted PDF, video, audio, or image is playable inside Zappy yet.");return}
      setDraftSourceGate("ready");setDraftSourceGateKey(`${draftSequenceId}:${draftChapterTitle}`);setDraftSourceGateMessage(`${matched.resources.length} verified source item${matched.resources.length===1?"":"s"} ready inside Zappy.`);
    }).catch(error=>{
      if(!active||error instanceof DOMException&&error.name==="AbortError")return;
      setDraftSourceGate("blocked");setDraftSourceGateKey("");setDraftSourceGateMessage(error instanceof Error?error.message:"The exact source could not be checked.");
    });
    return()=>{active=false;controller.abort()};
  },[role,draftSequenceId,draftChapterTitle]);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{if(active)setSequencesLoading(true)});
    const curriculum=curriculumFor(draftBoard,draftGrade,draftSubject);
    const sequencePromise=curriculum?.coverage==="textbook-catalogue"
      ? loadCurriculumBookSequences(draftBoard,draftGrade,draftSubject,role==="teacher")
      : Promise.resolve(frameworkSequence(draftBoard,draftGrade,draftSubject)?[frameworkSequence(draftBoard,draftGrade,draftSubject)!]:[]);
    sequencePromise.then(sequences=>{
      if(!active)return;
      setDraftSequences(sequences);setSequencesLoading(false);
      const requestedId=requestedDraftBookId.current;
      const nextSequence=(requestedId?sequences.find(item=>item.id===requestedId):null)||(role==="child"?sequences.find(item=>isExactDikshaBookId(item.id)):null)||sequences[0]||null;
      const preserved=Boolean(nextSequence&&nextSequence.id===requestedId);
      const pilotIndex=role==="teacher"&&draftBoard==="Karnataka State Board"&&draftGrade==="Class 8"&&draftSubject.toLowerCase()==="science"&&nextSequence
        ? exactCurriculumChapterIndex(nextSequence.chapters,"Force and Pressure")
        : -1;
      requestedDraftBookId.current=nextSequence?.id||"";
      setDraftBookId(nextSequence?.id||"");
      setDraftChapterIndex(current=>preserved&&nextSequence?Math.min(current,nextSequence.chapters.length-1):pilotIndex>=0?pilotIndex:0);
    }).catch(()=>{if(active){setDraftSequences([]);requestedDraftBookId.current="";setDraftBookId("");setSequencesLoading(false)}});
    return()=>{active=false};
  },[draftBoard,draftGrade,draftSubject,role]);

  useEffect(()=>{
    if(!loop||!activeSequence)return;
    const refreshDay=()=>{
      const nextToday=localDayKey();
      if(nextToday===loop.dayKey)return;
      const next=rollDailyLoop(loop,nextToday,activeSequence.chapters.length);
      setLoop(next);setConfidence(next.lastConfidence);if(role==="child"){setStudentMapStep("lesson");setQuestReceipt(null)}
      window.localStorage.setItem(storageKey,JSON.stringify(next));
      onContextChange(contextFrom(next,activeSequence));
      setStatus(role==="teacher"?"Today’s next class step is ready.":role==="parent"?"Today’s family support step is ready.":"Today’s next learning step is ready.");
    };
    const onVisible=()=>{if(document.visibilityState==="visible")refreshDay()};
    const nextMidnight=new Date();
    nextMidnight.setHours(24,0,0,50);
    const midnightTimer=window.setTimeout(refreshDay,nextMidnight.getTime()-Date.now());
    window.addEventListener("focus",refreshDay);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus",refreshDay);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[loop,activeSequence,storageKey,onContextChange,role]);

  useEffect(()=>{
    if(!loop?.reminderEnabled||loop.completedToday||!activeSequence)return;
    const notify=()=>{
      if(document.visibilityState==="hidden")return;
      const now=new Date();
      const clock=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const noticeKey=`${storageKey}:notice:${loop.dayKey}`;
      if(clock<loop.reminderTime||clock<"07:00"||clock>"20:30"||window.localStorage.getItem(noticeKey))return;
      window.localStorage.setItem(noticeKey,"shown");
      if("Notification" in window&&Notification.permission==="granted"){
        new Notification("Zappy daily loop",{body:`${roleGuide.notification}: ${activeSequence.chapters[loop.chapterIndex]}`});
      }else{
        setStatus(`${roleGuide.notification}: ${activeSequence.chapters[loop.chapterIndex]}`);
      }
    };
    const onVisible=()=>{if(document.visibilityState==="visible")notify()};
    const [hour,minute]=loop.reminderTime.split(":").map(Number);
    const reminderAt=new Date();
    reminderAt.setHours(hour,minute,0,0);
    const reminderTimer=reminderAt.getTime()>Date.now()
      ? window.setTimeout(notify,reminderAt.getTime()-Date.now())
      : null;
    queueMicrotask(notify);window.addEventListener("focus",notify);document.addEventListener("visibilitychange",onVisible);
    return()=>{
      if(reminderTimer!==null)window.clearTimeout(reminderTimer);
      window.removeEventListener("focus",notify);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[loop,activeSequence,storageKey,roleGuide.notification]);

  useEffect(()=>{
    if(role!=="teacher"||!completionRequest||!loop||!activeSequence||processedCompletionRequest.current===completionRequest.id)return;
    processedCompletionRequest.current=completionRequest.id;
    if(loop.completedToday)return;
    const loopConfidence:LoopConfidence=completionRequest.needsReview?"needs-help":completionRequest.strong?"mastered":"steady";
    queueMicrotask(()=>{
      const next=completeDailyLoop(loop,loopConfidence,activeSequence.chapters);
      setLoop(next);
      window.localStorage.setItem(storageKey,JSON.stringify(next));
      onContextChange({board:next.board,grade:next.grade,subject:next.subject,chapter:activeSequence.chapters[next.chapterIndex]||"",bookId:activeSequence.id,book:activeSequence.name,source:activeSequence.source,chapters:activeSequence.chapters});
      setConfidence(loopConfidence);
      setStatus(completionRequest.needsReview?"Class outcome saved. This chapter stays in tomorrow’s preparation.":"Class outcome saved. The exact next chapter will unlock on the next daily loop.");
    });
  },[completionRequest,loop,activeSequence,role,storageKey,onContextChange]);

  function chooseDraftContext(nextBoard:string,nextGrade:string){
    const available=curriculumSubjects(nextBoard,nextGrade);
    const fallback=BOARD_SUBJECTS[nextBoard]||[];
    const options=available.length?available:fallback;
    const chosen=options.find(item=>item.toLowerCase().includes("science"))||options[0]||"";
    setDraftSubject(chosen);requestedDraftBookId.current="";setDraftBookId("");setDraftChapterIndex(0);setStatus("");
  }
  function saveStage(){
    if(!draftCurriculum||!selectedDraftSequence||!selectedDraftSequence.chapters.length)return;
    if(role==="child"&&!draftSequencePlayable){setStatus("This exact book is indexed, but its playable in-Zappy source adapter is not connected yet. Choose a source-ready book to build the path.");return}
    const next=createDailyLoopState({
      board:draftBoard,grade:draftGrade,subject:draftSubject,
      bookId:selectedDraftSequence.id,bookName:selectedDraftSequence.name,
      sourceFingerprint:sourceFingerprint(selectedDraftSequence),
      chapterIndex:draftChapterIndex,sessionMinutes:draftMinutes,
      reminderEnabled:loop?.reminderEnabled||false,reminderTime:loop?.reminderTime||"18:00",
    });
    setActiveSequence(selectedDraftSequence);setConfidence(null);setQuestReceipt(null);setStudentMapStep("lesson");setStudentSetupStep(0);shouldFocusStudentNode.current=role==="child";setEditing(false);setStatus("Adventure built! Tap the glowing lesson node to begin.");
    persist(next,selectedDraftSequence);
  }
  function finishToday(){
    if(!loop||!activeSequence||!confidence)return;
    const next=completeDailyLoop(loop,confidence,activeSequence.chapters);
    persist(next,activeSequence);
    if(role==="child")setStudentMapStep("next");
    setStatus(confidence==="needs-help"?"Tomorrow will revisit this same chapter with more support.":"Tomorrow’s exact next chapter is ready.");
  }
  async function toggleReminder(){
    if(!loop)return;
    const enabling=!loop.reminderEnabled;
    if(enabling&&"Notification" in window&&Notification.permission==="default")await Notification.requestPermission();
    persist({...loop,reminderEnabled:enabling});
    setStatus(enabling?("Notification" in window&&Notification.permission==="granted"?"Daily browser reminder enabled while Zappy is available.":"In-app daily reminder enabled; browser notification permission is off."):"Daily reminders paused.");
  }
  function updateReminderTime(value:string){
    if(!loop)return;
    const safe=value<"07:00"?"07:00":value>"20:30"?"20:30":value;
    persist({...loop,reminderTime:safe});
  }

  useEffect(()=>{
    if(role!=="child"||!loop||editing||!shouldFocusStudentNode.current)return;
    shouldFocusStudentNode.current=false;
    window.requestAnimationFrame(()=>studentActiveNodeRef.current?.focus());
  },[role,loop,editing]);

  if(!loaded)return <section id={dailyLoopId} className="daily-loop-shell loading" aria-label="Loading daily learning loop"><div className="daily-loop-loading"><span>⚡</span><p><b>Loading your daily loop…</b><small>Checking the saved curriculum stage</small></p></div></section>;
  if(!loop||editing){
    if(role==="child"){
      const canContinue=studentSetupStep===0?Boolean(draftBoard&&draftGrade):studentSetupStep===1?Boolean(draftSubject&&draftSequencePlayable&&!sequencesLoading):studentSetupStep===2?Boolean(draftSequencePlayable&&selectedDraftSequence?.chapters[draftChapterIndex]):true;
      const previewChapters=selectedDraftSequence?.chapters.slice(draftChapterIndex,draftChapterIndex+3)||[];
      return <section id={dailyLoopId} className="student-path-onboarding" aria-label="Build your study adventure">
        <div className="student-onboarding-sky" aria-hidden="true"><span/><span/><i>✦</i><i>✦</i><i>✦</i><b>🏔</b></div>
        <header>
          <div className="student-onboarding-mascot"><Mascot/><span>{studentSetupStep===0?"Pick your world!":studentSetupStep===1?"Now find your real book!":studentSetupStep===2?"Plant today’s flag!":"Your path is ready!"}</span></div>
          <div><small>BUILD YOUR ZAPPY WORLD · {studentSetupStep+1}/4</small><h2>{studentSetupStep===0?"Where do you learn?":studentSetupStep===1?"Choose your learning power":studentSetupStep===2?"Where should today begin?":"Preview your adventure"}</h2><p>{studentSetupStep===3?"Every node follows the exact order in your selected source.":"One quick choice at a time—then Zappy builds one real lesson quest for each day."}</p></div>
        </header>
        <nav className="student-onboarding-trail" aria-label="Adventure builder progress">
          {[0,1,2,3].map(step=><span className={step<studentSetupStep?"done":step===studentSetupStep?"current":""} aria-current={step===studentSetupStep?"step":undefined} key={step}>{step<studentSetupStep?"✓":step+1}<small>{["World","Book","Start","Preview"][step]}</small></span>)}
        </nav>
        <div className={`student-builder-stage stage-${studentSetupStep}`}>
          {studentSetupStep===0&&<div className="student-builder-choice"><div className="student-builder-stage-title"><span aria-hidden="true">🗺️</span><p><small>WORLD 1</small><b>Choose your board</b></p></div><div className="student-board-worlds">{BOARD_OPTIONS.map((item,index)=><button type="button" aria-pressed={draftBoard===item} className={draftBoard===item?"selected":""} onClick={()=>{setDraftBoard(item);chooseDraftContext(item,draftGrade)}} key={item}><span aria-hidden="true">{["🌳","🌊","🌺","🏰","🚀","⭐"][index]||"⚡"}</span><b>{item.replace(" State Board","")}</b><small>{draftBoard===item?"Selected world":"Tap to explore"}</small></button>)}</div><label className="student-level-picker"><span><b>Your level</b><small>LKG through Class 12</small></span><select value={draftGrade} onChange={event=>{const value=event.target.value;setDraftGrade(value);setDraftMinutes(value==="LKG"||value==="UKG"?8:15);chooseDraftContext(draftBoard,value)}}>{GRADE_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label></div>}
          {studentSetupStep===1&&<div className="student-builder-choice"><div className="student-builder-stage-title"><span aria-hidden="true">📚</span><p><small>WORLD 2</small><b>Choose the exact learning trail</b></p></div><div className="student-power-pickers"><label><span>⚡ Subject power</span><select value={draftSubject} onChange={event=>{setDraftSubject(event.target.value);requestedDraftBookId.current="";setDraftBookId("");setDraftChapterIndex(0);setStatus("")}}>{draftSubjects.length?draftSubjects.map(item=><option key={item}>{item}</option>):<option value="">Official source pending</option>}</select></label><label><span>📖 Exact book</span><select value={draftBookId} disabled={sequencesLoading||!draftSequences.length} onChange={event=>chooseDraftBook(event.target.value)}>{sequencesLoading?<option value="">Zappy is finding exact books…</option>:draftSequences.length?draftSequences.map(item=><option value={item.id} key={item.id}>{item.name} · {item.mediums.join(", ")||"official"}</option>):<option value="">No verified sequence available</option>}</select></label></div><div className={`student-builder-gate ${draftSequencePlayable?"ready":"blocked"}`} role="status"><span>{sequencesLoading||draftSourceGate==="checking"?"⏳":draftSequencePlayable?"✓":"🔒"}</span><p><b>{sequencesLoading?"Searching the source library…":draftSourceGate==="checking"?"Checking this exact chapter…":draftSequencePlayable?"Playable source and exact order verified":selectedDraftSequence?"Path stays locked":"This trail is still locked"}</b><small>{sequencesLoading?"Zappy is finding exact books for this subject.":draftSourceGateMessage}</small></p></div></div>}
          {studentSetupStep===2&&<div className="student-builder-choice"><div className="student-builder-stage-title"><span aria-hidden="true">🚩</span><p><small>WORLD 3</small><b>Place today’s starting flag</b></p></div><label className="student-chapter-flag"><span><b>Start at chapter</b><small>You can return and change this later</small></span><select value={draftChapterIndex} disabled={!selectedDraftSequence} onChange={event=>setDraftChapterIndex(Number(event.target.value))}>{selectedDraftSequence?.chapters.map((item,index)=><option value={index} key={`${index}-${item}`}>{index+1}. {item}</option>)||<option value={0}>Choose a book first</option>}</select></label><fieldset className="student-time-power"><legend>Choose today’s power-up time</legend>{([8,15,25,40] as const).map(minutes=><button type="button" aria-pressed={draftMinutes===minutes} className={draftMinutes===minutes?"active":""} onClick={()=>setDraftMinutes(minutes)} key={minutes}><span>{minutes}</span><small>MIN</small></button>)}</fieldset></div>}
          {studentSetupStep===3&&<div className="student-builder-preview"><div className="student-builder-stage-title"><span aria-hidden="true">⚡</span><p><small>READY TO PLAY</small><b>Your first three map nodes</b></p></div><ol>{previewChapters.map((chapter,index)=><li className={index===0?"active":"locked"} key={`${chapter}-${index}`}><span>{index===0?"▶":"🔒"}</span><p><small>{index===0?"TODAY":"UPCOMING"}</small><b>{chapter}</b></p></li>)}</ol><div className="student-preview-proof"><span>✓</span><p><b>{draftBoard} · {draftGrade} · {draftSubject}</b><small>{selectedDraftSequence?.name} · {draftMinutes} minute daily quest</small></p></div></div>}
        </div>
        {status&&<div className="student-path-status" role="status">{status}</div>}
        <footer className="student-builder-actions"><div>{loop&&<button onClick={()=>{setEditing(false);setStudentSetupStep(0);setStatus("")}}>CANCEL</button>}{studentSetupStep>0&&<button onClick={()=>setStudentSetupStep(step=>Math.max(0,step-1) as 0|1|2|3)}>← BACK</button>}</div>{studentSetupStep<3?<button className="primary" disabled={!canContinue} onClick={()=>setStudentSetupStep(step=>Math.min(3,step+1) as 0|1|2|3)}>CONTINUE →</button>:<button className="primary" disabled={!draftCurriculum||!draftSequencePlayable} onClick={saveStage}>BUILD MY ADVENTURE →</button>}</footer>
      </section>;
    }
    return <section id={dailyLoopId} className="daily-loop-shell setup" aria-label="Choose current learning stage">
      <header><div><span>{roleGuide.icon}</span><p><small>{roleGuide.eyebrow}</small><b>Choose the exact stage once</b></p></div><em>SOURCE-GATED</em></header>
      <div className="loop-setup-copy"><div><small>START HERE</small><h2>Where are {role==="teacher"?"your students":role==="parent"?tenant:"you"} learning right now?</h2><p>Zappy saves this stage on this device, then recommends one finite source-grounded loop per day. It never invents the next chapter.</p></div><div className="loop-finite-rule"><b>One day = one loop</b><span>Learn → recall → apply → done</span></div></div>
      <div className="loop-stage-grid">
        <label>Board<select value={draftBoard} onChange={event=>{const value=event.target.value;setDraftBoard(value);chooseDraftContext(value,draftGrade)}}>{BOARD_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Class<select value={draftGrade} onChange={event=>{const value=event.target.value;setDraftGrade(value);setDraftMinutes(value==="LKG"||value==="UKG"?8:15);chooseDraftContext(draftBoard,value)}}>{GRADE_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Subject<select value={draftSubject} onChange={event=>{setDraftSubject(event.target.value);requestedDraftBookId.current="";setDraftBookId("");setDraftChapterIndex(0);setStatus("")}}>{draftSubjects.length?draftSubjects.map(item=><option key={item}>{item}</option>):<option value="">Official source pending</option>}</select></label>
        <label>Exact book / framework<select value={draftBookId} disabled={sequencesLoading||!draftSequences.length} onChange={event=>chooseDraftBook(event.target.value)}>{sequencesLoading?<option value="">Loading exact books…</option>:draftSequences.length?draftSequences.map(item=><option value={item.id} key={item.id}>{item.name} · {item.mediums.join(", ")||"official"}</option>):<option value="">No verified sequence available</option>}</select></label>
        <label className="loop-chapter-select">Current chapter / module<select value={draftChapterIndex} disabled={!selectedDraftSequence} onChange={event=>setDraftChapterIndex(Number(event.target.value))}>{selectedDraftSequence?.chapters.map((item,index)=><option value={index} key={`${index}-${item}`}>{index+1}. {item}</option>)||<option value={0}>Choose an exact book first</option>}</select></label>
        <fieldset><legend>Daily focus time</legend>{([8,15,25,40] as const).map(minutes=><button type="button" className={draftMinutes===minutes?"active":""} onClick={()=>setDraftMinutes(minutes)} key={minutes}>{minutes} min</button>)}</fieldset>
      </div>
      <div className={`loop-source-check ${draftCurriculum&&selectedDraftSequence?"ready":"blocked"}`}><span>{draftCurriculum&&selectedDraftSequence?"✓":"!"}</span><p><b>{draftCurriculum?draftCurriculum.coverageLabel:"Official curriculum source missing"}</b><small>{selectedDraftSequence?`${selectedDraftSequence.name} · ${selectedDraftSequence.chapters.length} ordered items`:draftCurriculum?"Select an exact book sequence. Recommendations remain paused until then.":"This selectable path is visible, but Zappy will not recommend from a fallback subject list."}</small></p>{selectedDraftSequence&&<button type="button" onClick={()=>onStudy({board:draftBoard,grade:draftGrade,subject:draftSubject,chapter:selectedDraftSequence.chapters[draftChapterIndex]||"",bookId:selectedDraftSequence.id,book:selectedDraftSequence.name,source:selectedDraftSequence.source,chapters:selectedDraftSequence.chapters})}>PREVIEW IN ZAPPY →</button>}</div>
      {status&&<div className="loop-status" role="status">{status}</div>}
      <div className="loop-setup-actions">{loop&&<button onClick={()=>{setEditing(false);setStatus("")}}>CANCEL</button>}<button className="primary" disabled={!draftCurriculum||!selectedDraftSequence} onClick={saveStage}>START MY DAILY LOOP →</button></div>
    </section>;
  }

  if(!activeSequence)return null;
  const recommendation=getDailyRecommendation(loop,activeSequence.chapters);
  const streak=calculateDailyStreak(loop.history,today);
  const currentChapter=activeSequence.chapters[loop.chapterIndex];
  const progress=Math.round((loop.chapterIndex+(loop.completedToday&&recommendation.action!=="revisit"?1:0))/activeSequence.chapters.length*100);
  if(role==="child"){
    const confidenceChoice=confidence==="needs-help"?{icon:"🛟",label:"Need help",detail:"This lesson will stay for a supported revisit."}:confidence==="steady"?{icon:"👍",label:"Getting it",detail:"A short recall comes before the next chapter."}:confidence==="mastered"?{icon:"⭐",label:"Mastered",detail:"The exact next chapter can unlock tomorrow."}:null;
    const nextTitle=recommendation.courseComplete?"Course complete":recommendation.nextChapter;
    const questDone=Boolean(questReceipt)||loop.completedToday;
    const mapProgress=loop.completedToday?3:questDone&&studentMapStep==="finish"?2:questDone?1:0;
    const liveMessage=loop.completedToday?"Today’s path is complete. The next lesson stays locked until tomorrow.":questDone?`Lesson complete. ${confidenceChoice?.label||"Reflection"} saved. The finish checkpoint is unlocked.`:`Today’s lesson is ready: ${currentChapter}`;
    return <section id={dailyLoopId} className={`student-daily-path ${loop.completedToday?"complete":"active"}`} aria-label={`Daily study path: ${currentChapter}`}>
      <header className="student-path-header">
        <div><span>⚡</span><p><small>{loop.grade} · {loop.subject}</small><b>Today’s study path</b><em>{activeSequence.name}</em></p></div>
        <div className="student-path-stats"><span><b>{streak}</b><small>day streak</small></span><span><b>{loop.sessionMinutes}m</b><small>today</small></span><span><b>{loop.chapterIndex+1}/{activeSequence.chapters.length}</b><small>lessons</small></span></div>
        <button onClick={()=>{prepareDraftFrom(loop);setStudentSetupStep(0);setEditing(true);setStatus("")}}>CHANGE</button>
      </header>
      <div className="student-path-progress" role="progressbar" aria-label="Book progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}% through ${activeSequence.name}`}><i style={{width:`${Math.max(3,progress)}%`}}/><span>{progress}% through this book</span></div>
      <div className={`student-game-world map-stage-${mapProgress}`}>
        <div className="student-world-art" aria-hidden="true"><span className="cloud one"/><span className="cloud two"/><span className="sun">✦</span><span className="mountains"/><span className="hills"/><i className="tree one"/><i className="tree two"/><i className="flower one"/><i className="flower two"/></div>
        <div className="student-world-banner"><span>🗺️</span><p><small>TODAY’S ADVENTURE</small><b>{loop.completedToday?"Path cleared!":questDone?"Checkpoint unlocked!":"Tap the glowing node"}</b></p><em>{mapProgress}/3 STOPS</em></div>
        <p className="visually-hidden" aria-live="polite">{liveMessage}</p>
        <div className="student-path-route">
        <svg className="student-path-track" viewBox="0 0 100 580" preserveAspectRatio="none" aria-hidden="true"><path className="track-shadow" d="M25 72 C25 128 75 135 75 215 S25 285 25 360 S75 430 75 500 S50 545 50 565"/><path className="track-base" d="M25 72 C25 128 75 135 75 215 S25 285 25 360 S75 430 75 500 S50 545 50 565"/><path className="track-fill" d="M25 72 C25 128 75 135 75 215 S25 285 25 360 S75 430 75 500 S50 545 50 565"/></svg>
        <ol className="student-path-road" aria-label="Today’s ordered adventure stops">
          <li className={`student-path-stop quest side-left ${questDone?"done":studentMapStep==="lesson"?"current":"ready"}`}>
            <button ref={studentMapStep==="lesson"?studentActiveNodeRef:undefined} className="student-path-node" aria-current={studentMapStep==="lesson"&&!loop.completedToday?"step":undefined} aria-label={`${questDone?"Completed":"Active"} lesson: ${currentChapter}`} onClick={()=>{setStudentMapStep("lesson");onStudy(contextFrom(loop,activeSequence))}}><span aria-hidden="true">{questDone?"✓":"▶"}</span><b>LEARN</b><small>{questDone?"Completed":"Play now"}</small><i aria-hidden="true">★★★</i></button>
            {!questDone&&<div className="student-map-zappy" aria-hidden="true"><Mascot small/><span>Start here!</span></div>}
            {studentMapStep==="lesson"&&<div className="student-path-bubble"><small>{questDone?"LESSON CLEARED":"YOUR ACTIVE QUEST"}</small><h2>{currentChapter}</h2><p>{loop.sessionMinutes} playful minutes through the exact source you chose.</p><button onClick={()=>onStudy(contextFrom(loop,activeSequence))}>{questDone?"REPLAY QUEST":"START MY QUEST"} →</button></div>}
          </li>
          <li className={`student-path-stop reflect side-right ${questDone?studentMapStep==="reflect"?"current":"done":"locked"}`}>
            <button ref={studentMapStep==="reflect"?studentActiveNodeRef:undefined} className="student-path-node" disabled={!questDone} aria-current={studentMapStep==="reflect"&&!loop.completedToday?"step":undefined} aria-label={questDone?`Reflection completed: ${confidenceChoice?.label||"saved"}`:"Reflection checkpoint locked; complete the lesson first"} onClick={()=>setStudentMapStep("reflect")}><span aria-hidden="true">{questDone?confidenceChoice?.icon||"✓":"🔒"}</span><b>CHECK</b><small>{questDone?"Unlocked":"Locked"}</small></button>
            {studentMapStep==="reflect"&&questDone&&<div className="student-path-bubble"><small>QUEST RESULT SAVED</small><h3>{confidenceChoice?.icon} {confidenceChoice?.label}</h3><p>{confidenceChoice?.detail} You already answered this inside the quest—no second form.</p>{!loop.completedToday&&<button onClick={()=>setStudentMapStep("finish")}>GO TO FINISH FLAG →</button>}</div>}
          </li>
          <li className={`student-path-stop finish side-left ${loop.completedToday?"done":questDone?studentMapStep==="finish"?"current":"ready":"locked"}`}>
            <button ref={studentMapStep==="finish"?studentActiveNodeRef:undefined} className="student-path-node" disabled={!questDone} aria-current={studentMapStep==="finish"&&!loop.completedToday?"step":undefined} aria-label={loop.completedToday?"Finish checkpoint completed":questDone?"Finish checkpoint unlocked":"Finish checkpoint locked; complete the lesson first"} onClick={()=>setStudentMapStep("finish")}><span aria-hidden="true">{loop.completedToday?"✓":questDone?"⚑":"🔒"}</span><b>FINISH</b><small>{loop.completedToday?"Completed":questDone?"Unlocked":"Locked"}</small></button>
            {studentMapStep==="finish"&&questDone&&<div className="student-path-bubble finish-bubble"><small>{loop.completedToday?"TODAY COMPLETE":"FINAL CHECKPOINT"}</small><h3>{loop.completedToday?"You cleared today’s map!":`Save “${confidenceChoice?.label}” and finish?`}</h3><p>{loop.completedToday?"No extra lesson starts automatically. Come back tomorrow for the next node.":"This is the only button that advances your daily path."}</p>{!loop.completedToday&&<button onClick={finishToday}>FINISH TODAY’S PATH</button>}</div>}
          </li>
          <li className={`student-path-stop next side-right ${loop.completedToday?studentMapStep==="next"?"current newly-unlocked":"ready":"locked"}`}>
            <button ref={studentMapStep==="next"?studentActiveNodeRef:undefined} className="student-path-node" disabled={!loop.completedToday} aria-current={studentMapStep==="next"?"step":undefined} aria-label={loop.completedToday?`Next lesson preview: ${nextTitle}; available tomorrow`:"Next lesson locked until today’s path is finished"} onClick={()=>setStudentMapStep("next")}><span aria-hidden="true">{loop.completedToday?(recommendation.courseComplete?"🏁":recommendation.action==="revisit"?"↻":"→"):"🔒"}</span><b>NEXT</b><small>{loop.completedToday?"Tomorrow":"Locked"}</small></button>
            {studentMapStep==="next"&&loop.completedToday&&<div className="student-path-bubble next-bubble"><div className="student-celebration" aria-hidden="true"><i>✦</i><span>🏆</span><i>✦</i></div><small>{recommendation.courseComplete?"BOOK PATH COMPLETE":"UP NEXT · TOMORROW"}</small><h3>{nextTitle}</h3><p>{recommendation.reason}</p><em>{recommendation.courseComplete?"PATH COMPLETE":recommendation.action==="revisit"?"SUPPORTED REVISIT":"LOCKED UNTIL TOMORROW"}</em></div>}
          </li>
        </ol>
        </div>
        <div className="student-world-destination" aria-hidden="true"><span>🏰</span><i>Tomorrow’s gate</i></div>
      </div>
      <details className="student-path-why"><summary><span>💡</span><p><b>Why this lesson?</b><small>See how Zappy chose it</small></p><i>⌄</i></summary><div><p>{recommendation.reason}</p><span>✓ Same selected source</span><span>✓ Exact book order</span><span>✓ Your confidence feedback</span><span>✕ No watch-time ranking</span></div></details>
      <footer className="student-path-footer"><div><button className={loop.reminderEnabled?"on":""} onClick={toggleReminder}><i/>{loop.reminderEnabled?"PAUSE REMINDER":"REMIND ME DAILY"}</button>{loop.reminderEnabled&&<label>At <input type="time" min="07:00" max="20:30" value={loop.reminderTime} onChange={event=>updateReminderTime(event.target.value)}/></label>}</div><small>One finite path per day. No autoplay and no endless feed.</small></footer>
      {status&&<div className="student-path-status" role="status">{status}</div>}
    </section>;
  }
  return <section id={dailyLoopId} className={`daily-loop-shell active role-${role}`} aria-label={`${roleGuide.eyebrow}: ${currentChapter}`}>
    <header><div><span>{roleGuide.icon}</span><p><small>{roleGuide.eyebrow}</small><b>{roleGuide.title}</b></p></div><div className="loop-header-stats">{role!=="teacher"&&<span><b>{streak}</b><small>day rhythm</small></span>}<span><b>{loop.sessionMinutes}m</b><small>{role==="teacher"?"class plan":"focus cap"}</small></span><span><b>{loop.chapterIndex+1}/{activeSequence.chapters.length}</b><small>{curriculumFor(loop.board,loop.grade,loop.subject)?.coverage==="textbook-catalogue"?"book":"framework"}</small></span></div><button onClick={()=>{prepareDraftFrom(loop);setEditing(true);setStatus("")}}>CHANGE STAGE</button></header>
    <div className="loop-context-line"><span>{loop.board}</span><i>›</i><span>{loop.grade}</span><i>›</i><span>{loop.subject}</span><i>›</i><b>{activeSequence.name}</b><button type="button" onClick={()=>onStudy(contextFrom(loop,activeSequence))}>SOURCE PROOF</button></div>
    <div className="loop-feed">
      <article className={`loop-today-card ${loop.completedToday?"complete":""}`}>
        <div className="loop-card-rank"><span>{loop.completedToday?"✓":"1"}</span><i>{loop.completedToday?"COMPLETE":"FOR YOU · TODAY"}</i></div>
        <div className="loop-today-copy"><small>{loop.completedToday?roleGuide.done:roleGuide.today}</small><h2>{currentChapter}</h2><p>{loop.completedToday?"Your feedback chose tomorrow’s path. No extra task is added today.":`${loop.sessionMinutes} focused minutes from the exact source you selected.`}</p><div className="loop-mini-progress"><i style={{width:`${Math.max(3,progress)}%`}}/><span>{progress}% through this sequence</span></div></div>
        {!loop.completedToday?<div className="loop-actions"><button className="open-study-loop" onClick={()=>onStudy(contextFrom(loop,activeSequence))}>{roleGuide.open}</button><div className="confidence-picker"><small>{role==="teacher"?"AFTER CLASS, HOW DID IT GO?":"AFTER THE SESSION, HOW DID IT FEEL?"}</small><span>{([["needs-help","🛟","Need help"],["steady","👍","Getting it"],["mastered","⭐","Mastered"]] as [LoopConfidence,string,string][]).map(item=><button className={confidence===item[0]?"selected":""} onClick={()=>setConfidence(item[0])} key={item[0]}><i>{item[1]}</i>{item[2]}</button>)}</span></div><button className="complete-loop" disabled={!confidence} onClick={finishToday}>{roleGuide.complete}</button></div>:<div className="loop-done-seal"><span>✨</span><b>DONE FOR TODAY</b><small>Come back tomorrow—no endless feed.</small></div>}
      </article>
      <div className="loop-side-feed">
        <article className={`loop-next-card ${recommendation.action}`}><small>2 · UP NEXT</small><span>{recommendation.action==="revisit"?"↻":recommendation.courseComplete?"🏁":"→"}</span><h3>{recommendation.courseComplete?"Subject sequence complete":recommendation.nextChapter}</h3><p>{loop.completedToday?recommendation.reason:"Complete today’s loop and choose confidence to unlock the exact next step."}</p><em>{loop.completedToday?(recommendation.action==="revisit"?"REVISIT TOMORROW":recommendation.courseComplete?"CHOOSE A NEW STAGE":"READY TOMORROW"):"PREVIEW ONLY"}</em></article>
        <article className="loop-why-card"><small>3 · WHY THIS TOPIC?</small><h3>Transparent recommendation</h3><p>{recommendation.reason}</p><div><span>✓ Same selected source</span><span>✓ Exact book order</span><span>✓ Your confidence feedback</span><span>✕ No watch-time ranking</span></div></article>
      </div>
    </div>
    <div className="loop-flow-strip"><div>{roleGuide.flow.map((item,index)=><span key={item}><b>{index+1}</b>{item}</span>)}</div><p><b>Zappy AI suggestion</b>{loop.completedToday?recommendation.courseComplete?"Choose another verified subject or book when you are ready.":`${recommendation.action==="revisit"?"Revisit":"Next"}: ${recommendation.nextChapter}`:`Start with ${currentChapter}. One loop is enough today.`}</p></div>
    <footer><div className="loop-reminder-control"><button className={loop.reminderEnabled?"on":""} onClick={toggleReminder}><i/>{loop.reminderEnabled?"PAUSE SUGGESTIONS":"ENABLE DAILY REMINDER"}</button>{loop.reminderEnabled&&<label>Reminder time<input type="time" min="07:00" max="20:30" value={loop.reminderTime} onChange={event=>updateReminderTime(event.target.value)}/></label>}<small>Optional · at most once per day · 7:00–20:30 · works while Zappy is available</small></div><div className="loop-safety-note"><span>🧭</span><p><b>Engagement with an exit</b><small>Relevance, quick feedback and continuity—without autoplay, infinite scroll, streak-loss pressure or random rewards.</small></p></div></footer>
    {status&&<div className="loop-status" role="status">{status}</div>}
  </section>;
}

type QuestSourceState="checking"|"ready"|"unavailable"|"error";
type QuestConfidence="needs-help"|"steady"|"mastered";

function ZappyLessonQuest({role,actorId,tenant,initialContext,onComplete,onClose}:{role:Role;actorId:string;tenant:string;initialContext:StudyContext|null;onComplete?:(receipt:StudentQuestReceipt)=>void;onClose:()=>void}){
  const [board,setBoard]=useState(initialContext?.board||"CBSE");
  const [grade,setGrade]=useState(initialContext?.grade||"Class 8");
  const [subject,setSubject]=useState(initialContext?.subject||"Science");
  const [chapter,setChapter]=useState(initialContext?.chapter||"FORCE AND PRESSURE");
  const initialSequence=initialContext?.bookId?{
    id:initialContext.bookId,board:initialContext.board,grades:[initialContext.grade],subjects:[initialContext.subject],
    name:initialContext.book||"Exact selected book",mediums:[],edition:"Current saved edition",
    source:initialContext.source||"",chapters:initialContext.chapters||[initialContext.chapter],
  } satisfies CurriculumBookSequence:null;
  const [sequences,setSequences]=useState<CurriculumBookSequence[]>(initialSequence?[initialSequence]:[]);
  const [bookId,setBookId]=useState(initialContext?.bookId||"");
  const requestedBookId=useRef(initialContext?.bookId||"");
  const [sequenceLoading,setSequenceLoading]=useState(false);
  const [sourceState,setSourceState]=useState<QuestSourceState>("checking");
  const [sourceBook,setSourceBook]=useState<ZappySourceBook|null>(null);
  const [sourceChapter,setSourceChapter]=useState<ZappySourceChapter|null>(null);
  const [sourceMessage,setSourceMessage]=useState("");
  const [selectedResourceId,setSelectedResourceId]=useState("");
  const [proofOpen,setProofOpen]=useState(false);
  const [reloadToken,setReloadToken]=useState(0);
  const [stageIndex,setStageIndex]=useState(0);
  const [sparkChoice,setSparkChoice]=useState("");
  const [keyIdea,setKeyIdea]=useState("");
  const [sourceExample,setSourceExample]=useState("");
  const [roleNote,setRoleNote]=useState("");
  const [confidence,setConfidence]=useState<QuestConfidence|null>(null);
  const [completed,setCompleted]=useState(false);
  const [completionDayKey,setCompletionDayKey]=useState("");
  const [progressLoaded,setProgressLoaded]=useState(false);
  const emittedCompletion=useRef("");
  const importedSubjects=curriculumSubjects(board,grade);
  const subjects=importedSubjects.length?importedSubjects:(BOARD_SUBJECTS[board]||[]);
  const curriculum=curriculumFor(board,grade,subject);
  const activeSequence=sequences.find(item=>item.id===bookId)||null;
  const chapters=activeSequence?.chapters||[];
  const selectedResource=sourceChapter?.resources.find(item=>item.id===selectedResourceId)||sourceChapter?.resources[0]||null;
  const roleCopy={
    child:{icon:"⚡",eyebrow:"ZAPPY LEARNER QUEST",title:"The real chapter—played inside Zappy",subtitle:"Official reading and media, quick interaction, teach-back, then a clear finish.",useTitle:"Teach it back",usePrompt:"Explain one idea from the source in your own words. This is your private learning note.",usePlaceholder:"One thing I learned is…",finish:"FINISH MY QUEST"},
    teacher:{icon:"🦉",eyebrow:"ZAPPY TEACHER QUEST",title:"Prepare tomorrow’s class without leaving Zappy",subtitle:"Use the exact official chapter, collect teaching anchors and leave with a classroom opening.",useTitle:"Shape the classroom moment",usePrompt:"Write the opening line, demonstration or question you will use. Zappy will keep it beside this exact source.",usePlaceholder:"I will open the class by…",finish:"MARK PREPARATION DONE"},
    parent:{icon:"💙",eyebrow:"ZAPPY FAMILY QUEST",title:"Follow your child’s exact chapter inside Zappy",subtitle:"See the same official material, find the key idea and prepare one supportive conversation.",useTitle:"Plan one supportive question",usePrompt:"Write one simple question that invites your child to explain—without turning home into another classroom.",usePlaceholder:"I’ll ask: What did you notice about…",finish:"DONE SUPPORTING TODAY"},
  }[role];

  function chooseContext(nextBoard:string,nextGrade:string,nextSubject?:string){
    const available=curriculumSubjects(nextBoard,nextGrade);
    const fallback=BOARD_SUBJECTS[nextBoard]||[];
    const options=available.length?available:fallback;
    const chosen=nextSubject&&options.includes(nextSubject)?nextSubject:options.find(item=>item.toLowerCase().includes("science"))||options[0]||"";
    requestedBookId.current="";
    setSubject(chosen);setBookId("");setChapter("");setSourceMessage("");setCompleted(false);setCompletionDayKey("");setProgressLoaded(false);emittedCompletion.current="";
  }

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{if(active)setSequenceLoading(true)});
    const sequencePromise=curriculum?.coverage==="textbook-catalogue"
      ? loadCurriculumBookSequences(board,grade,subject)
      : Promise.resolve(frameworkSequence(board,grade,subject)?[frameworkSequence(board,grade,subject)!]:[]);
    sequencePromise.then(items=>{
      if(!active)return;
      const preferred=items.find(item=>item.id===requestedBookId.current)||items[0]||null;
      setSequences(items);setBookId(preferred?.id||"");requestedBookId.current=preferred?.id||"";
      setChapter(current=>preferred?.chapters.includes(current)?current:(preferred?.chapters[0]||""));
      setSequenceLoading(false);
    }).catch(()=>{
      if(!active)return;
      setSequences([]);setBookId("");setChapter("");setSequenceLoading(false);
    });
    return()=>{active=false};
  },[board,grade,subject,curriculum?.coverage]);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    queueMicrotask(()=>{if(active){setSourceBook(null);setSourceChapter(null);setSelectedResourceId("");setProgressLoaded(false);setCompleted(false);setCompletionDayKey("");emittedCompletion.current=""}});
    if(!bookId||!chapter){
      queueMicrotask(()=>{if(active){setSourceState("unavailable");setSourceMessage("Choose an exact book and chapter first.")}});
      return()=>controller.abort();
    }
    if(!isExactDikshaBookId(bookId)){
      queueMicrotask(()=>{if(active){
        setSourceState("unavailable");
        setSourceMessage("This framework path is indexed, but its authority-specific in-Zappy document adapter is not published yet. Zappy will not replace it with filler.");
      }});
      return()=>controller.abort();
    }
    queueMicrotask(()=>{if(active){setSourceState("checking");setSourceMessage("Checking the current Live status, licence and playable official resources…")}});
    loadZappySourceBook(bookId,controller.signal).then(book=>{
      if(!active)return;
      const matched=findZappySourceChapter(book,chapter)||null;
      setSourceBook(book);setSourceChapter(matched);
      if(!matched){
        setSourceState("unavailable");setSourceMessage("The saved chapter title no longer matches this Live book edition. Confirm the current stage before continuing.");
      }else if(!matched.resources.length){
        setSourceState("unavailable");setSourceMessage("This exact chapter is indexed, but DIKSHA did not return a playable, allowlisted Creative Commons PDF, video, audio or image for Zappy.");
      }else{
        setSelectedResourceId(matched.resources[0].id);setSourceState("ready");setSourceMessage("");
      }
    }).catch(error=>{
      if(!active||error instanceof DOMException&&error.name==="AbortError")return;
      setSourceState("error");setSourceMessage(error instanceof Error?error.message:"The source could not be prepared.");
    });
    return()=>{active=false;controller.abort()};
  },[bookId,chapter,reloadToken]);

  useEffect(()=>{
    if(!sourceBook||!sourceChapter||sourceState!=="ready")return;
    const storageKey=questProgressStorageKey({role,actorId,tenant,bookId:sourceBook.bookId,chapterId:sourceChapter.id});
    let restored:{stageIndex:number;sparkChoice:string;keyIdea:string;sourceExample:string;roleNote:string;confidence:QuestConfidence|null;completed:boolean;completionDayKey:string};
    try{
      const saved=JSON.parse(window.localStorage.getItem(storageKey)||"null") as {version?:number;stageIndex?:number;sparkChoice?:string;keyIdea?:string;sourceExample?:string;roleNote?:string;confidence?:QuestConfidence;completed?:boolean;completionDayKey?:string}|null;
      if(saved?.version===1){
        const completedToday=Boolean(saved.completed)&&saved.completionDayKey===localDayKey();
        restored=completedToday
          ? {stageIndex:Math.max(0,Math.min(4,Number(saved.stageIndex)||0)),sparkChoice:saved.sparkChoice||"",keyIdea:saved.keyIdea||"",sourceExample:saved.sourceExample||"",roleNote:saved.roleNote||"",confidence:saved.confidence||null,completed:true,completionDayKey:saved.completionDayKey||""}
          : {stageIndex:0,sparkChoice:"",keyIdea:"",sourceExample:"",roleNote:"",confidence:null,completed:false,completionDayKey:""};
      }else{
        restored={stageIndex:0,sparkChoice:"",keyIdea:"",sourceExample:"",roleNote:"",confidence:null,completed:false,completionDayKey:""};
      }
    }catch{
      restored={stageIndex:0,sparkChoice:"",keyIdea:"",sourceExample:"",roleNote:"",confidence:null,completed:false,completionDayKey:""};
    }
    queueMicrotask(()=>{
      setStageIndex(restored.stageIndex);setSparkChoice(restored.sparkChoice);setKeyIdea(restored.keyIdea);setSourceExample(restored.sourceExample);setRoleNote(restored.roleNote);
      setConfidence(restored.confidence);setCompleted(restored.completed);setCompletionDayKey(restored.completionDayKey);setProgressLoaded(true);
    });
  },[sourceBook,sourceChapter,sourceState,role,actorId,tenant]);

  useEffect(()=>{
    if(!progressLoaded||!sourceBook||!sourceChapter)return;
    const storageKey=questProgressStorageKey({role,actorId,tenant,bookId:sourceBook.bookId,chapterId:sourceChapter.id});
    window.localStorage.setItem(storageKey,JSON.stringify({version:1,stageIndex,sparkChoice,keyIdea,sourceExample,roleNote,confidence,completed,completionDayKey,updatedAt:new Date().toISOString()}));
  },[progressLoaded,sourceBook,sourceChapter,role,actorId,tenant,stageIndex,sparkChoice,keyIdea,sourceExample,roleNote,confidence,completed,completionDayKey]);

  useEffect(()=>{
    if(role!=="child"||!progressLoaded||!completed||completionDayKey!==localDayKey()||!confidence||!sourceBook||!sourceChapter||!chapter)return;
    const receipt:StudentQuestReceipt={
      id:`${actorId}:${tenant}:${completionDayKey}:${sourceBook.bookId}:${sourceChapter.id}:${confidence}`,
      actorId,tenant,dayKey:completionDayKey,bookId:sourceBook.bookId,chapter,confidence,
    };
    if(emittedCompletion.current===receipt.id)return;
    emittedCompletion.current=receipt.id;
    onComplete?.(receipt);
  },[role,actorId,tenant,progressLoaded,completed,completionDayKey,confidence,sourceBook,sourceChapter,chapter,onComplete]);

  const canContinue=stageIndex===0?Boolean(sparkChoice):stageIndex===1?Boolean(selectedResource):stageIndex===2?keyIdea.trim().length>=3&&sourceExample.trim().length>=3:stageIndex===3?roleNote.trim().length>=8:Boolean(confidence);
  function advance(){
    if(!canContinue)return;
    if(stageIndex<4){setStageIndex(value=>value+1);return}
    setCompletionDayKey(localDayKey());setCompleted(true);
  }
  function restartQuest(){
    emittedCompletion.current="";setStageIndex(0);setSparkChoice("");setKeyIdea("");setSourceExample("");setRoleNote("");setConfidence(null);setCompleted(false);setCompletionDayKey("");
  }
  function chooseBook(nextBookId:string){
    requestedBookId.current=nextBookId;setBookId(nextBookId);
    const next=sequences.find(item=>item.id===nextBookId);
    emittedCompletion.current="";setChapter(next?.chapters[0]||"");setSourceMessage("");setProgressLoaded(false);setCompleted(false);setCompletionDayKey("");
  }

  return <div className="modal-backdrop grounded-backdrop" role="dialog" aria-modal="true" aria-label={`${roleCopy.eyebrow}: in-Zappy source quest`}>
    <div className="grounded-studio zappy-quest-studio">
      <header>
        <div className="grounded-brand"><span>{roleCopy.icon}</span><div><small>{roleCopy.eyebrow}</small><h2>{roleCopy.title}</h2><p>{roleCopy.subtitle}</p></div></div>
        <div className="grounded-integrity"><i>✓</i><span><b>Stay inside Zappy</b><small>Secure source adapter · no portal handoff</small></span></div>
        <button onClick={onClose} aria-label="Close Zappy Lesson Quest">×</button>
      </header>
      <div className="grounded-body">
        <aside className="grounded-context">
          <div className="grounded-user"><span>{roleCopy.icon}</span><p><b>{role==="teacher"?"Ms. Sharma":role==="parent"?`${tenant} family`:"Arjun"}</b><small>{tenant} · {role}</small></p></div>
          <small className="grounded-section-label">CHOOSE THE EXACT SOURCE</small>
          <label>Board<select value={board} onChange={event=>{const value=event.target.value;setBoard(value);chooseContext(value,grade)}}>{BOARD_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Class<select value={grade} onChange={event=>{const value=event.target.value;setGrade(value);chooseContext(board,value)}}>{GRADE_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Subject<select value={subject} onChange={event=>chooseContext(board,grade,event.target.value)}>{subjects.length?subjects.map(item=><option key={item}>{item}</option>):<option value="">Official subject list pending</option>}</select></label>
          <label>Exact book / framework<select value={bookId} disabled={sequenceLoading||!sequences.length} onChange={event=>chooseBook(event.target.value)}>{sequenceLoading?<option value="">Loading exact books…</option>:sequences.length?sequences.map(item=><option value={item.id} key={item.id}>{item.name} · {item.mediums.join(", ")||"official"}</option>):<option value="">No exact book sequence</option>}</select></label>
          <label>Chapter / module<select value={chapter} disabled={!chapters.length} onChange={event=>{emittedCompletion.current="";setChapter(event.target.value);setProgressLoaded(false);setCompleted(false);setCompletionDayKey("")}}>{chapters.length?chapters.map(item=><option key={item}>{item}</option>):<option value="">Exact chapter required</option>}</select></label>
          <div className={`grounded-coverage ${sourceState==="ready"?"ready":"blocked"}`}><span>{sourceState==="ready"?"✓":"!"}</span><p><b>{sourceState==="checking"?"Checking official source":sourceState==="ready"?`${sourceChapter?.resources.length||0} source items ready inside Zappy`:"Content gate active"}</b><small>{sourceState==="ready"?"Original media only; role actions are clearly separated from the source.":sourceMessage||"Zappy will not generate filler for an unavailable chapter."}</small></p></div>
          <div className="grounded-corpus-facts"><b>Zappy source rules</b><p>Exact book + exact chapter match<br/>Live status rechecked<br/>Per-item licence and attribution<br/>No arbitrary URL proxying<br/>No autoplay or infinite feed</p></div>
        </aside>
        <main className="grounded-main quest-main">
          <div className="grounded-title"><div><small>{sourceState==="ready"?"YOUR FINITE 5-STAGE QUEST":"SOURCE AVAILABILITY"}</small><h1>{chapter||`${subject||"Subject"} source needed`}</h1><p>{board} · {grade} · {subject||"No verified subject"} · {activeSequence?.name||"Exact book required"}</p></div>{curriculum&&<span className={`coverage-badge ${curriculum.coverage}`}>{curriculum.coverageLabel}</span>}</div>
          {sourceState==="checking"&&<section className="quest-checking" aria-live="polite"><div className="quest-loader"><i/><i/><i/></div><span>⚡</span><h2>Building your in-Zappy source trail…</h2><p>Checking the exact chapter, current status, licence and playable resources.</p></section>}
          {(sourceState==="unavailable"||sourceState==="error")&&<section className="grounded-empty"><span>{sourceState==="error"?"🛠️":"🔒"}</span><small>{sourceState==="error"?"SOURCE ADAPTER PAUSED":"EXACT CONTENT GATE"}</small><h2>{sourceState==="error"?"The official source is not responding":"This chapter is indexed, but its in-Zappy source is not ready"}</h2><p>{sourceMessage} Your learning position is safe and Zappy will not substitute a generic topic.</p><div><b>What remains available</b><span>Board · class · subject · exact book · chapter order</span></div><button className="quest-retry" onClick={()=>setReloadToken(value=>value+1)}>TRY SOURCE AGAIN</button></section>}
          {sourceState==="ready"&&sourceBook&&sourceChapter&&selectedResource&&<>
            <section className="source-provenance quest-provenance">
              <div className="source-book"><span>📚</span><p><small>EXACT LIVE SOURCE</small><b>{sourceBook.title}</b><em>Book ID · {sourceBook.bookId}</em></p></div>
              <div className="source-detail"><p><b>Current chapter</b><span>{sourceChapter.order}. {sourceChapter.title}</span></p><p><b>Playback boundary</b><span>Original official asset streamed through Zappy; no source page navigation</span></p><p><b>Role projection</b><span>{role==="teacher"?"Teacher preparation notes":role==="parent"?"Simple family support":"Learner self-check · no quiz formation"}</span></p></div>
              <button onClick={()=>setProofOpen(true)}>SOURCE PROOF</button>
            </section>
            {!completed?<>
              <nav className="quest-stage-nav" aria-label="Lesson quest stages">{ZAPPY_QUEST_STAGES.map((item,index)=><button key={item.id} className={index===stageIndex?"current":index<stageIndex?"done":""} disabled={index>stageIndex} onClick={()=>index<=stageIndex&&setStageIndex(index)}><i>{index<stageIndex?"✓":item.icon}</i><span><b>{item.label}</b><small>{index===stageIndex?`Stage ${index+1} of 5`:index<stageIndex?"Done":"Locked"}</small></span></button>)}</nav>
              <div className="quest-progress"><i style={{width:`${(stageIndex+1)*20}%`}}/><span>{stageIndex+1}/5 · one clear finish</span></div>
              {stageIndex===0&&<section className="quest-card quest-spark"><div className="quest-card-copy"><small>STAGE 1 · SPARK</small><h2>Before you open the source, where are you starting?</h2><p>This does not test you. It helps Zappy present the same official chapter at the right pace.</p></div><div className="spark-orbit"><span>?</span><i>{roleCopy.icon}</i></div><div className="quest-choice-grid">{[["🌱","New to me","Start with the textbook or first explainer"],["🔎","I know a little","Look for one idea that changes my thinking"],["🚀","Ready to explain","Watch for proof, examples and exceptions"]].map(item=><button className={sparkChoice===item[1]?"selected":""} onClick={()=>setSparkChoice(item[1])} key={item[1]}><span>{item[0]}</span><b>{item[1]}</b><small>{item[2]}</small></button>)}</div></section>}
              {stageIndex===1&&<section className="quest-card quest-learn"><header><div><small>STAGE 2 · LEARN FROM THE ORIGINAL</small><h2>{selectedResource.title}</h2><p>{selectedResource.category} · {selectedResource.rights.license}</p></div><button onClick={()=>setProofOpen(true)}>ⓘ SOURCE PROOF</button></header><div className="quest-source-layout"><div className="quest-resource-rail">{sourceChapter.resources.map(resource=><button className={resource.id===selectedResource.id?"active":""} onClick={()=>setSelectedResourceId(resource.id)} key={resource.id}><span>{sourceKindIcon(resource.kind)}</span><p><b>{resource.title}</b><small>{resource.kind.toUpperCase()} · {resource.rights.license}</small></p></button>)}</div><ZappySourceViewer resource={selectedResource}/></div><div className="quest-viewer-note"><span>🛡️</span><p><b>Original source, not a generated explanation</b><small>Zappy is playing the published asset inside its own secure viewer. Claims, page text and examples are not invented around it.</small></p></div></section>}
              {stageIndex===2&&<section className="quest-card quest-hunt"><div className="hunt-heading"><span>🗺️</span><div><small>STAGE 3 · SOURCE TREASURE HUNT</small><h2>Collect two anchors from what you just viewed</h2><p>There is no fake auto-grading. Your answers stay tied to this exact chapter and help your next review.</p></div></div><label><span><b>🔑 One key word or idea</b><small>Copy a short term, then use your own words.</small></span><input value={keyIdea} onChange={event=>setKeyIdea(event.target.value)} placeholder="Key word or idea…"/></label><label><span><b>💡 One example, image or moment</b><small>Record where the idea became clearer.</small></span><input value={sourceExample} onChange={event=>setSourceExample(event.target.value)} placeholder="The example I noticed…"/></label><div className="hunt-rule"><span>✓</span><p><b>Source-grounded interaction</b><small>Zappy never marks a made-up answer key as textbook truth. A reviewed question pack can be added later with exact citations.</small></p></div></section>}
              {stageIndex===3&&<section className={`quest-card quest-use role-${role}`}><div className="use-mission"><span>{role==="teacher"?"🧑‍🏫":role==="parent"?"🤝":"🧠"}</span><div><small>STAGE 4 · USE IT</small><h2>{roleCopy.useTitle}</h2><p>{roleCopy.usePrompt}</p></div></div><div className="use-source-anchor"><span><b>KEY IDEA</b>{keyIdea}</span><span><b>SOURCE MOMENT</b>{sourceExample}</span></div><textarea value={roleNote} onChange={event=>setRoleNote(event.target.value)} placeholder={roleCopy.usePlaceholder}/><small className="private-note">🔒 Saved only to this Zappy profile on this device.</small></section>}
              {stageIndex===4&&<section className="quest-card quest-reflect"><div className="reflect-burst"><span>⭐</span><i/><i/><i/></div><small>STAGE 5 · REFLECT</small><h2>How ready are you to meet this idea again?</h2><p>Your choice controls the next deterministic step. “Need help” revisits; the others continue only through the selected book order.</p><div className="reflect-options">{([["needs-help","🛟","Need help","Revisit with another source item"],["steady","👍","Getting it","Continue after a spaced recall"],["mastered","🌟","Mastered","Move to the exact next chapter"]] as [QuestConfidence,string,string,string][]).map(item=><button className={confidence===item[0]?"selected":""} onClick={()=>setConfidence(item[0])} key={item[0]}><span>{item[1]}</span><b>{item[2]}</b><small>{item[3]}</small></button>)}</div><div className="fixed-reward"><span>⚡ +25</span><span>🪙 +5</span><p>Fixed quest reward · never random</p></div></section>}
              <footer className="quest-actions"><button disabled={stageIndex===0} onClick={()=>setStageIndex(value=>Math.max(0,value-1))}>← BACK</button><div><b>{ZAPPY_QUEST_STAGES[stageIndex].label}</b><small>{canContinue?"Ready for the next stage":"Complete this small step to continue"}</small></div><button className="primary" disabled={!canContinue} onClick={advance}>{stageIndex===4?roleCopy.finish:"CONTINUE →"}</button></footer>
            </>:<section className="quest-complete"><div className="complete-burst"><i>✦</i><span>⚡</span><i>✦</i></div><small>QUEST COMPLETE · CLEAR EXIT</small><h2>{role==="teacher"?"Tomorrow’s class source is prepared":role==="parent"?"Today’s family support is ready":"You completed today’s source quest"}</h2><p>{confidence==="needs-help"?"Zappy saved this chapter for a supported revisit.":confidence==="mastered"?"Your exact next book chapter is ready for the daily loop.":"A short spaced recall comes before the exact next chapter."}</p><div className="complete-recap"><span><b>🔑 Key idea</b>{keyIdea}</span><span><b>{role==="teacher"?"🧑‍🏫 Class move":role==="parent"?"🤝 Support question":"🧠 Teach-back"}</b>{roleNote}</span><span><b>📚 Source</b>{selectedResource.title} · {selectedResource.id}</span></div><div className="complete-reward"><span>⚡ 25 XP</span><span>🪙 5 coins</span><span>✓ Progress saved</span></div><div className="complete-actions"><button onClick={restartQuest}>REPLAY THIS QUEST</button><button className="primary" onClick={onClose}>DONE FOR TODAY</button></div><small className="complete-boundary">No autoplay. No next lesson starts until you choose it.</small></section>}
            {proofOpen&&<SourceProofDrawer book={sourceBook} chapter={sourceChapter} resource={selectedResource} onClose={()=>setProofOpen(false)}/>}
          </>}
        </main>
      </div>
    </div>
  </div>
}

function ZappySourceViewer({resource}:{resource:ZappySourceResource}){
  const url=zappyMediaUrl(resource.id);
  if(resource.kind==="pdf")return <div className="zappy-source-viewer pdf"><iframe src={`${url}#toolbar=1&navpanes=0`} title={`${resource.title} official PDF`}/></div>;
  if(resource.kind==="video")return <div className="zappy-source-viewer video"><video key={resource.id} controls playsInline preload="metadata" src={url}>Your browser cannot play this official video.</video></div>;
  if(resource.kind==="audio")return <div className="zappy-source-viewer audio"><span>🎧</span><h3>{resource.title}</h3><audio key={resource.id} controls preload="metadata" src={url}>Your browser cannot play this official audio.</audio></div>;
  // Dynamic, licence-gated source images are streamed through the Zappy adapter.
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="zappy-source-viewer image"><img src={url} alt={`${resource.title} official source`}/></div>;
}

function SourceProofDrawer({book,chapter,resource,onClose}:{book:ZappySourceBook;chapter:ZappySourceChapter;resource:ZappySourceResource;onClose:()=>void}){
  return <div className="source-proof-shade" role="dialog" aria-modal="true" aria-label="Source proof">
    <aside className="source-proof-drawer">
      <header><div><span>🛡️</span><p><small>ZAPPY SOURCE PROOF</small><b>Why this item is allowed into the player</b></p></div><button onClick={onClose}>×</button></header>
      <div className="proof-verdict"><span>✓</span><p><b>Live, exact and allowlisted</b><small>The media URL is resolved server-side from this DIKSHA content ID. Zappy never proxies a user-supplied URL.</small></p></div>
      <dl>
        <div><dt>Hosted on</dt><dd>DIKSHA</dd></div>
        <div><dt>Exact book</dt><dd>{book.title}</dd></div>
        <div><dt>Book ID</dt><dd>{book.bookId}</dd></div>
        <div><dt>Chapter</dt><dd>{chapter.order}. {chapter.title}</dd></div>
        <div><dt>Resource</dt><dd>{resource.title}</dd></div>
        <div><dt>Content ID</dt><dd>{resource.id}</dd></div>
        <div><dt>Format</dt><dd>{resource.mimeType}</dd></div>
        <div><dt>Licence</dt><dd>{resource.rights.license}</dd></div>
        <div><dt>Creator</dt><dd>{resource.creator||"Not supplied in the returned record"}</dd></div>
        <div><dt>Copyright</dt><dd>{[resource.copyright,resource.copyrightYear].filter(Boolean).join(" · ")||"Not supplied in the returned record"}</dd></div>
        <div><dt>Attribution</dt><dd>{resource.attributions.join(" · ")||resource.copyright||resource.creator||"Use the content ID and licence shown above"}</dd></div>
        <div><dt>Updated</dt><dd>{resource.lastUpdatedOn||book.edition||"Date not supplied"}</dd></div>
      </dl>
      <div className="proof-rights"><p><b>{resource.rights.adaptationAllowed?"Adaptations may be possible under this licence":"Original playback only in Zappy"}</b><small>{resource.rights.adaptationAllowed?"Any derived Zappy explanation or quiz still needs exact citations and licence-compatible review.":"Zappy does not turn this item into an AI summary, quiz or altered asset."}</small></p>{resource.rights.commercialClearanceRequired&&<p className="warning"><b>Commercial clearance required</b><small>This item carries a NonCommercial condition. A startup release needs rights review before monetised use.</small></p>}</div>
      <footer><small>DIKSHA hosts ecosystem content; its presence is not a blanket endorsement by DIKSHA or the Government of India.</small><button onClick={onClose}>BACK TO QUEST</button></footer>
    </aside>
  </div>;
}

const BOARD_SUBJECTS:Record<string,string[]>={
  "Karnataka State Board":["Environmental Studies","Mathematics","English","Kannada","Hindi","Science","Social Science","Physics","Chemistry","Biology","Computer Science","Accountancy","Business Studies","Economics","Political Science","Sociology"],
  "Kerala State Board":["Environmental Studies","Mathematics","English","Malayalam","Hindi","Science","Social Science","Physics","Chemistry","Biology","Computer Science","Accountancy","Business Studies","Economics","History","Geography"],
  "Tamil Nadu State Board":["Environmental Studies","Mathematics","English","Tamil","Hindi","Science","Social Science","Physics","Chemistry","Botany","Zoology","Computer Science","Commerce","Accountancy","Economics","History","Geography"],
  "Telangana State Board":["Environmental Studies","Mathematics","English","Telugu","Hindi","General Science","Physical Science","Biological Science","Social Studies","Physics","Chemistry","Botany","Zoology","Computer Science","Commerce","Accountancy","Economics","History","Geography"],
  "CBSE":["Environmental Studies","Mathematics","English","Hindi","Science","Social Science","Physics","Chemistry","Biology","Computer Science","Accountancy","Business Studies","Economics","History","Geography","Political Science","Sociology","Psychology"],
  "ICSE / ISC":["Environmental Studies","Mathematics","English Language","English Literature","Hindi","Science","History & Civics","Geography","Physics","Chemistry","Biology","Computer Applications","Accounts","Commerce","Economics","Political Science","Sociology","Psychology"],
};
function ImportantQuestionsPredictor({role,onClose,onStudy}:{role:Role;onClose:()=>void;onStudy:()=>void}){
  const [board,setBoard]=useState("CBSE");
  const [grade,setGrade]=useState("Class 8");
  const [subject,setSubject]=useState("Science");
  const [chapter,setChapter]=useState("FORCE AND PRESSURE");
  const [status,setStatus]=useState("");
  const [paperFiles,setPaperFiles]=useState<{name:string;size:number}[]>([]);
  const paperInput=useRef<HTMLInputElement|null>(null);
  const importedSubjects=curriculumSubjects(board,grade);
  const subjects=importedSubjects.length?importedSubjects:(BOARD_SUBJECTS[board]||[]);
  const curriculum=curriculumFor(board,grade,subject);
  const chapters=curriculum?.chapters||[];
  const paperProtocol=[
    "ZAPPY VERIFIED-PAPER REVIEW PROTOCOL",
    `Exam path: ${board} · ${grade} · ${subject} · ${chapter||"selected module"}.`,
    "Create an evidence table for every matched question: exact wording, exam year, paper name, marks, question number, source citation, and whether it is an exact repeat or a concept match.",
    "Analyse at least five distinct official exam years before calculating frequency. Show the formula and sample size for any score.",
    "Separate observed frequency from an upcoming-exam probability. Do not claim a probability unless the paper set and method justify it; never present a prediction as a guarantee.",
    "If the attached papers are incomplete, duplicated, unofficial, or for a different syllabus edition, identify the problem and stop.",
  ].join("\n");
  function chooseContext(nextBoard:string,nextGrade:string,nextSubject?:string){
    const available=curriculumSubjects(nextBoard,nextGrade);
    const fallback=BOARD_SUBJECTS[nextBoard]||[];
    const options=available.length?available:fallback;
    const chosen=nextSubject&&options.includes(nextSubject)?nextSubject:options.find(item=>item.toLowerCase().includes("science"))||options[0]||"";
    const record=curriculumFor(nextBoard,nextGrade,chosen);
    setSubject(chosen);setChapter(record?.chapters[0]||"");setStatus("");
  }
  function openPaperAnalysis(){
    paperInput.current?.click();
  }
  function stagePaperFiles(files:FileList|null){
    if(!files)return;
    const next=[...files].filter(file=>file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")).map(file=>({name:file.name,size:file.size}));
    setPaperFiles(next);
    setStatus(next.length?`${next.length} PDF file${next.length===1?"":"s"} staged inside Zappy. They are not counted as verified until year, board and question citations pass review.`:"No PDF question papers were selected.");
  }
  return <div className="modal-backdrop predictor-backdrop" role="dialog" aria-modal="true" aria-label="Important Questions evidence workspace">
    <div className="predictor-modal">
      <header className="predictor-header"><div><span>🎯</span><div><small>ZAPPY EXAM EVIDENCE</small><h2>Important Questions Predictor</h2><p>Predictions unlock only after verified previous-year papers are attached</p></div></div><button onClick={onClose}>×</button></header>
      <div className="predictor-body">
        <aside className="predictor-filters">
          <h3>Exam setup</h3>
          <label>Board<select value={board} onChange={event=>{const value=event.target.value;setBoard(value);chooseContext(value,grade)}}>{BOARD_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Class<select value={grade} onChange={event=>{const value=event.target.value;setGrade(value);chooseContext(board,value)}}>{GRADE_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Subject<select value={subject} onChange={event=>{const value=event.target.value;setSubject(value);setChapter(curriculumFor(board,grade,value)?.chapters[0]||"");setStatus("")}}>{subjects.length?subjects.map(item=><option key={item}>{item}</option>):<option value="">Official source pending</option>}</select></label>
          <label>Chapter / module<select value={chapter} disabled={!chapters.length} onChange={event=>setChapter(event.target.value)}>{chapters.length?chapters.map(item=><option key={item}>{item}</option>):<option value="">Curriculum source required</option>}</select></label>
          <input ref={paperInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={event=>stagePaperFiles(event.target.files)}/>
          <button className="generate-btn" onClick={openPaperAnalysis}>＋ ADD OFFICIAL PAPERS IN ZAPPY</button>
          {curriculum&&<button className="predictor-source-link" onClick={onStudy}>OPEN CURRICULUM IN ZAPPY →</button>}
          <div className="source-note"><span>🛡️</span><p><b>Evidence gate is active</b>No years, frequencies, marks or probabilities are generated until each claim can point to a verified paper.</p></div>
        </aside>
        <section className="predictor-results">
          <div className="prediction-summary evidence-locked">
            <div><span className="confidence-ring"><b>—</b><small>locked</small></span><div><small>{board} · {grade} · {subject}</small><h3>{chapter||"Select a sourced module"}</h3><p>{paperFiles.length} staged · 0 verified papers · minimum 5 distinct years required</p></div></div>
            <div className="pattern-bars"><span><b>Files staged in Zappy</b><em>{paperFiles.length}</em></span><span><b>Verified years</b><em>0 / 5</em></span><span><b>Prediction status</b><em>Locked</em></span></div>
          </div>
          <div className="results-toolbar"><div><b>Verified question evidence</b><small>Every result will need a year, paper, marks, question number and citation</small></div><span>0 verified</span></div>
          <div className="predictor-empty-state"><span>🔒</span><small>NO FABRICATED PREDICTIONS</small><h2>Add five or more official previous-year papers inside Zappy</h2><p>Zappy has the curriculum catalogue, but its verified exam-paper corpus is still empty. Files stay in this in-app intake; names, years, questions and marks must be reviewed before any frequency or probability unlocks.</p>{paperFiles.length>0&&<div className="staged-paper-list">{paperFiles.map(file=><span key={`${file.name}-${file.size}`}><b>📄 {file.name}</b><small>{Math.max(1,Math.round(file.size/1024))} KB · staged, not verified</small></span>)}</div>}<textarea readOnly value={paperProtocol} aria-label="Verified paper review protocol"/>{status&&<div role="status">{status}</div>}</div>
        </section>
      </div>
      <footer className="predictor-footer"><div><b>0 verified questions · prediction locked</b><small>Required next: official paper files + year + board + marks + source citation</small></div><button className="secondary-action" onClick={onStudy}>OPEN ZAPPY SOURCE QUEST</button><button className="primary-action" onClick={openPaperAnalysis}>{role==="teacher"?"ADD PAPER FILES":"ADD PAPER EVIDENCE"} →</button></footer>
    </div>
  </div>
}

function FeatureHub({ role, onClose, onQuestions, onStudy }: { role: Role; onClose: () => void; onQuestions: () => void; onStudy: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const modules = [
    ["🎯","Important Questions Predictor","Verified-paper evidence gate, cited frequency and honest probability locks","live"],
    ["🎮","Seven Finite Game Engines","Builder, Grower, Mixer, Explorer, City, Story Forge, Lab","live"],
    ["📓","Zappy Lesson Quest","Official source player, five playful stages and in-app source proof","live"],
    ["🤖","Three-Personality AI","The same verified source, adapted for learner, teacher and parent","live"],
    ["🎤","Skills Arena","Communication, speaking, vlogging, leadership, mindfulness and more","live"],
    ["💬","Groups & Social","Class chats, friend challenges, weekly competition leagues","ready"],
    ["🏆","Ranks & Rewards","XP, streaks, badges, hearts, coins, physical reward shop","ready"],
    ["📚","Curriculum Cloud","Six curriculum paths · LKG–Class 12 · coverage labels visible","ready"],
    ["🔔","Smart Notifications","Streak, rank, assignment, report and celebration nudges","ready"],
    ["💸","Teacher Earnings","Student referrals, teacher referrals, UPI payout history","ready"],
    ["👨‍👩‍👧","Parent Command Centre","Nightly reports, alerts, child linking, coin gifts, practice","ready"],
    ["🏫","School & Super Admin","School analytics, content, users, billing, moderation and payouts","ready"],
    ["🛍️","Rewards Shop","Personalised stationery, digital costumes, shields and refills","ready"],
    ["🛡️","Child Safety","Filtered chat, no external links/media, parent visibility, reporting","ready"],
    ["📊","Deep Analytics","Retention, mastery, activity, engine use and revenue dashboards","ready"],
    ["✨","Fast Onboarding","Role selection, avatar, Zappy ID, board, class and school setup","ready"],
    ["💳","Plans & Subscriptions","Free, Plus, Family, Family Pro, annual plans and coin packs","ready"],
    ["🧠","Content Intelligence","Syllabus tagging, level generation, caching and review workflows","ready"],
    ["🚀","Growth Command Centre","Referrals, school pipeline, seasonal campaigns and experiment tracking","ready"],
  ];
  if (selected !== null) return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="module-modal"><header><button onClick={()=>setSelected(null)}>← ALL FEATURES</button><div><span>{modules[selected][0]}</span><div><small>ZAPPY PRODUCT MODULE</small><h2>{modules[selected][1]}</h2><p>{modules[selected][2]}</p></div></div><button onClick={onClose}>×</button></header><ModuleDetail index={selected} onQuestions={onQuestions} onStudy={onStudy}/></div></div>;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="All Zappy features"><div className="feature-modal">
    <header><div><span className="bolt">ϟ</span><div><small>COMPLETE PLATFORM MAP</small><h2>Every Zappy system</h2><p>Role: {role[0].toUpperCase()+role.slice(1)} · one account, many groups and workspaces</p></div></div><button onClick={onClose}>×</button></header>
    <div className="feature-grid">{modules.map((m,i)=><button key={m[1]} className={i===0?"featured":""} onClick={()=>i===0?onQuestions():setSelected(i)}><span>{m[0]}</span><div><h3>{m[1]}</h3><p>{m[2]}</p><small>OPEN MODULE →</small></div></button>)}</div>
  </div></div>;
}

function ModuleDetail({ index, onQuestions, onStudy }: { index: number; onQuestions: () => void; onStudy: () => void }) {
  const [tab, setTab] = useState(0);
  const [sent, setSent] = useState(false);
  const [coins, setCoins] = useState(2480);
  const [notif, setNotif] = useState([true,true,true,false]);
  if (index === 1) return <GameUniverse />;
  if (index === 2) return <ModuleShell title="Zappy Lesson Quest" tabs={["Quest","Player","Source proof"]} tab={tab} setTab={setTab}><div className="notebook-module-preview"><div className="notebook-preview-source"><span>📚</span><div><small>OFFICIAL SOURCE SELECTED</small><h3>Board → class → exact book → chapter</h3><p>Zappy rechecks the Live record and per-item licence, then streams the original PDF, video, audio or image through its own secure player.</p></div><b>NO EXIT</b></div><div className="notebook-preview-flow">{[["1","Spark","Choose your starting point"],["2","Learn","Play the real source in Zappy"],["3","Play","Collect two source anchors"],["4","Use it","Make a role-specific note"],["5","Reflect","Choose the next deterministic step"]].map(item=><div key={item[0]}><span>{item[0]}</span><b>{item[1]}</b><p>{item[2]}</p></div>)}</div><div className="notebook-preview-truth"><span>✓</span><p><b>Secure internal source adapter</b><small>The browser never opens a DIKSHA page. Zappy resolves allowlisted public assets server-side, retains the exact content ID and shows creator, copyright, attribution and licence in its Source Proof drawer.</small></p></div></div></ModuleShell>;
  if (index === 3) return <ModuleShell title="One source · three role-aware guides" tabs={["Learner AI","Teacher AI","Parent AI"]} tab={tab} setTab={setTab}><div className="agent-lab"><aside>{[["⚡","Study Guide","Age-appropriate · cited"],["🦉","Teaching Copilot","Lesson-ready · cited"],["💙","Parent Guide","Simple · supportive · cited"]].map((a,i)=><button className={tab===i?"active":""} onClick={()=>setTab(i)} key={a[1]}><span>{a[0]}</span><div><b>{a[1]}</b><small>{a[2]}</small></div></button>)}</aside><section><div className="agent-context"><span>SAME VERIFIED CONTEXT</span>Board · class · exact book · official resource · selected chapter</div><div className="agent-message">{tab===0?"I’ll play the exact source inside Zappy, help you collect key ideas and finish with a private teach-back. I won’t create or assign a quiz.":tab===1?"I’ll keep the original source visible while you collect a classroom opening, teaching anchors and a review-ready class check—without inventing textbook content or exam history.":"I’ll show the same source and help you prepare one supportive question, without generating or assigning a quiz."}</div><button onClick={onStudy}>OPEN ZAPPY LESSON QUEST</button></section></div></ModuleShell>;
  if (index === 4) return <ModuleShell title="AI Mirror Skills Arena" tabs={["All skills","My recordings","Score lab"]} tab={tab} setTab={setTab}><div className="skill-universe">{[["🗣️","Communication",7,10],["🎤","Public Speaking",4,10],["🎬","Vlogging",3,10],["👑","Leadership",2,8],["🧘","Mindfulness",5,8],["✨","Styling",2,8],["🤝","Social Skills",6,10],["💡","Creativity",4,8]].map(s=><button key={s[1] as string}><span>{s[0]}</span><div><h3>{s[1]}</h3><p>Level {s[2]} of {s[3]}</p><i><em style={{width:(Number(s[2])/Number(s[3])*100)+"%"}}/></i></div><b>★★★</b></button>)}</div><div className="mirror-score"><span>🎥</span><div><b>Measured results appear after a real Mirror take</b><p>Unavailable signals stay blank. Visual self-review never enters competition scoring.</p></div><button>OPEN SKILLS ARENA</button></div></ModuleShell>;
  if (index === 5) return <ModuleShell title="Safe groups & social learning" tabs={["Class 4-A","Science Squad","Gold League"]} tab={tab} setTab={setTab}><div className="group-layout"><aside>{[["🧪","Class 4-A","Ms Sharma: New assignment","3"],["🌟","Science Squad","Riya: Challenge accepted!","5"],["🏆","Gold League","Zappy: You moved to #4",""]].map((g,i)=><button className={tab===i?"active":""} onClick={()=>setTab(i)} key={g[1]}><span>{g[0]}</span><div><b>{g[1]}</b><small>{g[2]}</small></div><i>{g[3]}</i></button>)}</aside><section><div className="chat-message left"><b>Ms Sharma</b><p>Who’s ready for earthquake mode? 🌉</p><small>4:20 PM · Read by 28</small></div><div className="assignment-chat"><span>🌉</span><div><small>SCIENCE · GAME</small><b>Bridge Builder: Earthquake Mode</b><p>Due tomorrow · +30 coins</p><button>▶ START NOW</button></div></div><div className="chat-message right"><p>I’m doing it now! ⚡</p><small>4:23 PM · ✓✓</small></div>{sent&&<div className="chat-message right"><p>Challenge accepted. Beat 8,420 points! 🏆</p><small>Now · ✓</small></div>}<div className="group-input"><button>＋</button><input placeholder="Message safely…"/><button onClick={()=>setSent(true)}>➤</button></div></section></div></ModuleShell>;
  if (index === 6) return <ModuleShell title="Ranks, streaks & achievement economy" tabs={["Leaderboard","Badges","Coin rules"]} tab={tab} setTab={setTab}><div className="reward-overview"><div className="podium"><span>🥈<b>Riya</b><small>1,390 XP</small></span><span>🥇<b>Vivaan</b><small>1,520 XP</small></span><span>🥉<b>You</b><small>1,240 XP</small></span></div><div className="economy-rules">{[["🔥","14","day streak"],["🪙","2,480","coins"],["⚡","12,480","total XP"],["🛡️","1","streak shield"]].map(x=><div key={x[2]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div><div className="badge-cabinet">{["💯 Perfect Score","🦸 Helpful Hero","🔬 Science Master","⚡ Speed Demon","🦋 Social Butterfly","🔒 Challenge Crusher"].map((x,i)=><span className={i===5?"locked":""} key={x}>{x}</span>)}</div></div></ModuleShell>;
  if (index === 7) return <ModuleShell title="Curriculum cloud" tabs={["Textbook catalogue","Frameworks","Gaps"]} tab={tab} setTab={setTab}><div className="curriculum-head"><div><small>VISIBLE COVERAGE, NOT A PERCENTAGE GUESS</small><b>6 curriculum paths · LKG–Class 12 selectors</b></div><button>VIEW SOURCE MAP</button></div><div className="curriculum-coverage-ledger"><div><span>📚</span><p><b>DIKSHA textbook catalogue</b><small>CBSE + Karnataka, Kerala, Tamil Nadu and Telangana records where published</small></p><em>{curriculumStats.records.toLocaleString("en-IN")} records</em></div><div><span>🧸</span><p><b>Foundational stage</b><small>NCERT/CISCE framework strands; state textbook detail is labelled separately</small></p><em>FRAMEWORK</em></div><div><span>🏛️</span><p><b>ICSE / ISC</b><small>Official CISCE curriculum and syllabus paths; school-selected books must be added for page-level explanation</small></p><em>SYLLABUS</em></div><div><span>🔒</span><p><b>Missing source</b><small>Explanation remains blocked until an official source or the school’s prescribed text is connected</small></p><em>NO FILLER</em></div></div></ModuleShell>;
  if (index === 8) return <ModuleShell title="Personalised engagement system" tabs={["Inbox","Rules","Quiet hours"]} tab={tab} setTab={setTab}><div className="notification-console">{[["🔥","Streak ends in 3 hours","Riya is 80 XP ahead. One game fixes both.","Now"],["📉","Rank changed: #4 → #5","Karan overtook you. You’re one game from taking it back.","12m"],["📚","New Bridge Builder assignment","Ms Sharma · due tomorrow · 30 coins","1h"],["🎉","Personal best!","You scored 9,240 on Forces & Motion.","Yesterday"]].map((n,i)=><div key={n[1]}><span>{n[0]}</span><p><b>{n[1]}</b><small>{n[2]}</small></p><em>{n[3]}</em><button onClick={()=>setNotif(v=>v.map((x,j)=>j===i?!x:x))}>{notif[i]?"ON":"OFF"}</button></div>)}</div></ModuleShell>;
  if (index === 9) return <ModuleShell title="Teacher earnings" tabs={["Overview","Referrals","Payouts"]} tab={tab} setTab={setTab}><div className="earnings-hero"><div><small>UPCOMING PAYOUT · 1 AUG</small><b>₹8,450</b><p>Lifetime earnings ₹42,800</p></div><button>UPDATE UPI</button></div><div className="earnings-grid"><Metric icon="🧒" value="₹5,250" label="Student referrals" note="105 active × ₹50"/><Metric icon="👩‍🏫" value="₹3,200" label="Teacher referrals" note="16 active × ₹200"/><Metric icon="📈" value="+18%" label="This month" note="Best month yet"/><Metric icon="✅" value="98%" label="Active referrals" note="30-day qualified"/></div><div className="payout-list">{[["Priya Teacher","Teacher referral","₹200/mo","Active"],["Arjun Sharma","Student referral","₹50","Qualified"],["Meera Rao","Student referral","₹50","Day 24/30"]].map(x=><div key={x[0]}><span>👤</span><b>{x[0]}</b><small>{x[1]}</small><em>{x[2]}</em><i>{x[3]}</i></div>)}</div></ModuleShell>;
  if (index === 10) return <ModuleShell title="Parent command centre" tabs={["Nightly report","Smart alerts","Upcoming"]} tab={tab} setTab={setTab}><div className="nightly-report"><header><span>👦</span><div><small>THURSDAY · AI NIGHTLY REPORT</small><h2>Arjun’s learning day</h2></div><b>82</b></header><div className="report-grid"><article><span>✅</span><b>Mastered</b><p>Compression force · 9/10</p></article><article><span>🎯</span><b>Needs work</b><p>Tension force · 2/4</p></article><article><span>⏱️</span><b>Time</b><p>32m · class avg 24m</p></article><article><span>📈</span><b>Rank</b><p>#5 → #4 this week</p></article></div><div className="home-tip"><b>TRY THIS TONIGHT</b><p>Stack textbooks with a ruler across them and ask why some bridges are flat while others are arched.</p></div><button onClick={onQuestions}>VIEW NEXT TEST’S IMPORTANT QUESTIONS</button></div></ModuleShell>;
  if (index === 11) return <ModuleShell title="School & Zappy Super Admin" tabs={["Live overview","Schools","Content","Moderation"]} tab={tab} setTab={setTab}><div className="admin-metrics"><Metric icon="👥" value="48.2K" label="Total users" note="+1,204 today"/><Metric icon="⚡" value="12.8K" label="DAU" note="26.5% DAU/MAU"/><Metric icon="₹" value="₹18.4L" label="MRR" note="+14.2% MoM"/><Metric icon="🏫" value="184" label="Schools" note="12 onboarding"/></div><div className="admin-board"><section><h3>Live activity</h3>{["New school: Vidya Mandir · 420 students","Content level flagged: Mixer #1842","UPI payout batch ready · ₹2.8L","Streak anomaly resolved · 27 accounts"].map(x=><p key={x}><span>●</span>{x}<small>just now</small></p>)}</section><aside><h3>Platform health</h3><div className="health-ring">99.98%<small>uptime</small></div><p>AI generation <b>Healthy</b></p><p>Game services <b>Healthy</b></p><p>Payments <b>Healthy</b></p></aside></div></ModuleShell>;
  if (index === 12) return <ModuleShell title="Rewards shop" tabs={["Physical rewards","Digital boosts","My orders"]} tab={tab} setTab={setTab}><div className="shop-balance"><span>🪙</span><div><small>ZAPPY COINS</small><b>{coins.toLocaleString()}</b></div><button>EARN MORE</button></div><div className="shop-grid">{[["📓","Custom Notebook",1500],["✏️","Pencil Box Set",2000],["🖊️","Personalised Pens",800],["🎒","Mini Backpack",5000],["📦","Stationery Bundle",3500],["🦸","Avatar Costume",200],["🛡️","Streak Shield",100],["❤️","Heart Refill",50]].map(x=><article key={x[1] as string}><span>{x[0]}</span><h3>{x[1]}</h3><b>🪙 {x[2]}</b><button disabled={coins<Number(x[2])} onClick={()=>setCoins(c=>c-Number(x[2]))}>{coins>=Number(x[2])?"REDEEM":"NEED "+(Number(x[2])-coins)}</button></article>)}</div></ModuleShell>;
  if (index === 13) return <ModuleShell title="Child safety centre" tabs={["Controls","Moderation","Parent visibility"]} tab={tab} setTab={setTab}><div className="safety-grid">{[["🚫","External links blocked","No URLs can be shared in child groups."],["🖼️","External media blocked","Only approved Zappy stickers and assignments."],["🧹","Language filtering","Messages are checked before delivery."],["👨‍👩‍👧","Parent visibility","Parents can view every child group chat."],["🚩","Block & report","Reports enter a 24-hour moderation queue."],["🔐","Role isolation","Private AI chats and account data stay separate."]].map(x=><div key={x[1]}><span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p><i>ACTIVE</i></div>)}</div></ModuleShell>;
  if (index === 14) return <ModuleShell title="Deep analytics" tabs={["Engagement","Learning","Revenue"]} tab={tab} setTab={setTab}><div className="analytics-dashboard"><div className="analytics-chart"><header><span><b>Daily active learners</b><small>Last 30 days</small></span><em>+22.4%</em></header><div className="spark-bars">{[42,48,45,59,61,58,66,69,72,78,74,82,86,91].map((x,i)=><i key={i} style={{height:x+"%"}}/>)}</div></div><div className="heatmap"><h3>Subject popularity</h3>{["Science","Maths","English","EVS"].map((x,i)=><div key={x}><b>{x}</b>{Array.from({length:7},(_,j)=><i key={j} style={{opacity:.3+((i+j)%5)*.15}}/>)}</div>)}</div><div className="retention"><b>Week 4 retention</b><span>68%</span><p>Top cohort: teacher-invited learners · 76%</p></div></div></ModuleShell>;
  if (index === 15) return <ModuleShell title="Two-minute onboarding" tabs={["Role","Identity","Personalise"]} tab={tab} setTab={setTab}><div className="onboarding-demo"><div className="stepper">{["WHO ARE YOU","ZAPPY ID","PERSONALISE"].map((x,i)=><span className={i<=tab?"done":""} key={x}>{i+1}<b>{x}</b></span>)}</div>{tab===0&&<div className="onboard-cards">{[["🧒","Student","#58cc02"],["👩‍🏫","Teacher","#ce82ff"],["👨‍👩‍👧","Parent","#1cb0f6"]].map(x=><button key={x[1]} onClick={()=>setTab(1)} style={{borderColor:x[2]}}><span>{x[0]}</span><b>I’m a {x[1]}</b><small>Independent account · no approval needed</small></button>)}</div>}{tab===1&&<div className="identity-form"><div className="avatar-picker">{["🦁","🦊","🐬","🦄","🐼","🦋","🐉","🦅"].map(x=><button key={x}>{x}</button>)}</div><label>Name<input defaultValue="Arjun Sharma"/></label><label>Zappy ID<input defaultValue="@arjun_zappy"/><i>✓ Available</i></label><button onClick={()=>setTab(2)}>CONTINUE</button></div>}{tab===2&&<div className="personalise-form"><h2>Make Zappy yours</h2><div>{["CBSE","ICSE","Karnataka","Maharashtra","Tamil Nadu"].map(x=><button key={x}>{x}</button>)}</div><div>{Array.from({length:10},(_,i)=><button key={i}>Class {i+1}</button>)}</div><button>CREATE MY ZAPPY ID ⚡</button></div>}</div></ModuleShell>;
  if (index === 16) return <ModuleShell title="Plans & subscriptions" tabs={["Families","Schools","Coin packs"]} tab={tab} setTab={setTab}><div className="pricing-grid">{[["FREE","₹0","3 levels/day","Basic weekly report"],["ZAPPY PLUS","₹299/mo","Unlimited games + AI","Skills, shop, predictor"],["FAMILY","₹499/mo","Everything for 2 children","Nightly reports"],["FAMILY PRO","₹699/mo","Unlimited children","Priority support"]].map((x,i)=><article className={i===1?"popular":""} key={x[0]}>{i===1&&<em>MOST POPULAR</em>}<h3>{x[0]}</h3><b>{x[1]}</b><p>✓ {x[2]}</p><p>✓ {x[3]}</p><p>✓ {i===0?"Class groups":"Full leaderboard"}</p><button>{i===0?"CURRENT PLAN":"CHOOSE PLAN"}</button></article>)}</div></ModuleShell>;
  if (index === 17) return <ModuleShell title="Content intelligence operations" tabs={["Level pipeline","Syllabus tags","Review queue"]} tab={tab} setTab={setTab}><div className="pipeline">{[["1","Curriculum context","Board · class · subject · chapter"],["2","AI generation","Scenario · answers · hints · script"],["3","Safety validation","Age · accuracy · language · bias"],["4","Cache & deliver","Popular ≤100 cached · 100+ unique"],["5","Learn & improve","Performance tunes next difficulty"]].map(x=><div key={x[0]}><span>{x[0]}</span><div><b>{x[1]}</b><p>{x[2]}</p></div><i>✓</i></div>)}</div><div className="ops-stats"><Metric icon="🧩" value="184K" label="Generated levels" note="96.8% approved"/><Metric icon="⚡" value="84ms" label="Cached delivery" note="Global median"/><Metric icon="🛡️" value="42" label="Review queue" note="7 high priority"/><Metric icon="∞" value="Live" label="Level 100+" note="Unique every play"/></div></ModuleShell>;
  return <ModuleShell title="Growth command centre" tabs={["Acquisition","Referrals","Campaigns"]} tab={tab} setTab={setTab}><div className="growth-funnel">{[["Teachers invited","2,840"],["Students joined","18,420"],["Day-30 active","13,996"],["Paid families","4,218"]].map((x,i)=><div key={x[0]} style={{width:(100-i*14)+"%"}}><b>{x[1]}</b><span>{x[0]}</span></div>)}</div><div className="campaign-grid">{[["🏫","School B2B pipeline","42 schools · ₹8.4L potential"],["🎓","Exam season predictor","+38% conversion forecast"],["🎁","Diwali coin festival","12,440 waitlist"],["🤝","Parent referral","1 free month · 22% share rate"]].map(x=><article key={x[1]}><span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p><button>OPEN CAMPAIGN</button></article>)}</div></ModuleShell>;
}

type LoopChallenge={mission:string;q:string;options:string[];answer:number;hint:string;fact:string;scene:string};
type LoopWorld={icon:string;name:string;tagline:string;color:string;verb:string;challenges:LoopChallenge[]};
const ENDLESS_WORLDS:Record<GameTheme,LoopWorld>={
  Builder:{icon:"🌉",name:"Bridge Builder",tagline:"Design it. Load it. Watch physics decide.",color:"blue",verb:"BUILD",challenges:[
    {mission:"Support the supply truck",q:"Where should the strongest support go on this evenly loaded bridge?",options:["Only at the far left","Under the centre","Floating above it","Remove every support"],answer:1,hint:"The middle of a long span bends most.",fact:"A centre support shortens the unsupported span and shares the load.",scene:"🚚"},
    {mission:"Beat the wind tunnel",q:"Which bridge shape handles sideways forces best?",options:["A tall flat wall","A triangle-braced frame","Loose ropes only","One thin vertical stick"],answer:1,hint:"Triangles hold their shape when forces change direction.",fact:"Triangular bracing spreads forces through rigid members.",scene:"🌬️"},
    {mission:"Cross the muddy valley",q:"Why should a heavy bridge use wider foundations on soft ground?",options:["To increase pressure","To reduce pressure","To remove gravity","To make it warmer"],answer:1,hint:"The same force can be spread over more area.",fact:"A wider foundation lowers pressure by distributing force over a larger area.",scene:"🏞️"},
    {mission:"Stop the bridge shake",q:"What should an engineer add to reduce repeated vibration?",options:["A damper","More flags","A louder horn","Smooth paint"],answer:0,hint:"It absorbs motion energy.",fact:"Dampers reduce oscillation by absorbing and dissipating energy.",scene:"〰️"},
    {mission:"BOSS: carry the mega convoy",q:"Two identical trucks cross together. What happens to the bridge load?",options:["It becomes zero","It roughly doubles","Gravity switches off","The bridge gets lighter"],answer:1,hint:"Both trucks push downward.",fact:"Forces add. Two similar trucks create roughly twice the downward load.",scene:"🚛"},
  ]},
  Grower:{icon:"🌱",name:"Life Grower",tagline:"Raise a living world through every choice.",color:"green",verb:"GROW",challenges:[
    {mission:"Wake the seed",q:"Which three conditions usually help a seed germinate?",options:["Water, air and warmth","Paint, salt and darkness","Only bright light","Sugar and ice"],answer:0,hint:"A seed needs moisture, oxygen and a suitable temperature.",fact:"Water activates the seed, oxygen supports respiration and warmth enables reactions.",scene:"🌰"},
    {mission:"Feed the new leaves",q:"Which gas does a green plant use during photosynthesis?",options:["Oxygen only","Carbon dioxide","Helium","Hydrogen"],answer:1,hint:"Humans breathe it out.",fact:"Plants combine carbon dioxide and water using light energy to make glucose.",scene:"🌿"},
    {mission:"Rescue the drooping plant",q:"Which tissue carries water upward from the roots?",options:["Phloem","Xylem","Petal","Pollen"],answer:1,hint:"Think of a plant’s water pipes.",fact:"Xylem transports water and dissolved minerals from roots to the rest of the plant.",scene:"💧"},
    {mission:"Invite the pollinators",q:"What is transferred from anther to stigma during pollination?",options:["Seeds","Pollen grains","Roots","Fruit juice"],answer:1,hint:"It is a fine powder made by the flower.",fact:"Pollination transfers pollen to the stigma, enabling fertilisation.",scene:"🐝"},
    {mission:"BOSS: balance the habitat",q:"If all insects disappeared, which process would many flowering plants lose?",options:["Pollination","Gravity","Evaporation","Rock formation"],answer:0,hint:"Bees and butterflies perform it.",fact:"Many plants depend on insects for pollination and would reproduce less successfully.",scene:"🌻"},
  ]},
  Mixer:{icon:"⚗️",name:"Reaction Mixer",tagline:"Predict the reaction before the lab erupts.",color:"purple",verb:"MIX",challenges:[
    {mission:"Unlock the colour vault",q:"Blue litmus placed in an acid usually turns…",options:["Red","Green","Black","Colourless"],answer:0,hint:"Acids change blue litmus to a warm colour.",fact:"Acids turn blue litmus red; bases turn red litmus blue.",scene:"🧪"},
    {mission:"Separate the mystery mix",q:"Which method separates sand from water?",options:["Filtration","Melting","Magnetising water","Freezing sand"],answer:0,hint:"Use a barrier with tiny holes.",fact:"Filter paper lets water pass while trapping insoluble sand.",scene:"🔍"},
    {mission:"Power the fizz reactor",q:"An acid reacting with a carbonate commonly releases…",options:["Carbon dioxide","Gold","Oxygen only","Plastic"],answer:0,hint:"It is the gas in fizzy drinks.",fact:"Acid–carbonate reactions produce salt, water and carbon dioxide gas.",scene:"🫧"},
    {mission:"Save the iron gate",q:"Which conditions are needed for iron to rust?",options:["Oxygen and water","Only darkness","Carbon dioxide only","Dry nitrogen"],answer:0,hint:"Rust forms fastest in damp air.",fact:"Iron rusting requires both oxygen and water.",scene:"🔩"},
    {mission:"BOSS: cool the runaway beaker",q:"What is the safest first action if a classroom reaction becomes unexpected?",options:["Touch the beaker","Step back and alert the teacher","Smell it closely","Add random chemicals"],answer:1,hint:"Safety comes before finishing the experiment.",fact:"Move away, warn the responsible adult and follow the lab safety procedure.",scene:"🚨"},
  ]},
  Explorer:{icon:"🪐",name:"Cosmic Explorer",tagline:"Navigate planets, clues and lost worlds.",color:"orange",verb:"EXPLORE",challenges:[
    {mission:"Leave Earth orbit",q:"What force keeps the Moon moving around Earth?",options:["Gravity","Friction with air","Sound","Magnetism alone"],answer:0,hint:"The same force keeps your feet on the ground.",fact:"Earth’s gravity continually bends the Moon’s path into an orbit.",scene:"🌍"},
    {mission:"Land on the red planet",q:"Which planet is called the Red Planet?",options:["Venus","Mars","Neptune","Mercury"],answer:1,hint:"Its surface contains iron oxides.",fact:"Iron minerals in Martian soil give Mars its reddish appearance.",scene:"🔴"},
    {mission:"Survive lunar night",q:"Why is there almost no weather on the Moon?",options:["It has no substantial atmosphere","It has too many oceans","It spins too fast","The Sun avoids it"],answer:0,hint:"Weather needs a layer of gases.",fact:"The Moon lacks a thick atmosphere to create wind, clouds and ordinary weather.",scene:"🌙"},
    {mission:"Decode the star map",q:"A light-year measures…",options:["Time","Distance","Brightness","Temperature"],answer:1,hint:"It is how far light travels in one year.",fact:"A light-year is a huge unit of astronomical distance.",scene:"✨"},
    {mission:"BOSS: escape the black hole",q:"Why can light not escape past a black hole’s event horizon?",options:["Gravity curves spacetime extremely strongly","Light becomes heavy rain","There is a solid wall","Stars turn it off"],answer:0,hint:"The escape speed exceeds the speed of light.",fact:"Inside the event horizon, all future paths through spacetime lead inward.",scene:"🕳️"},
  ]},
  "Calculator City":{icon:"🏙️",name:"Calculator City",tagline:"Solve problems to power an evolving city.",color:"cyan",verb:"POWER",challenges:[
    {mission:"Power three apartment towers",q:"Each tower needs 24 energy cells. How many do three towers need?",options:["48","62","72","84"],answer:2,hint:"Add 24 three times.",fact:"24 × 3 = 72 energy cells.",scene:"🏢"},
    {mission:"Repair the water grid",q:"A 120-litre tank is 3/4 full. How much water is inside?",options:["30 L","60 L","90 L","100 L"],answer:2,hint:"Find one quarter, then multiply by three.",fact:"120 ÷ 4 = 30 and 30 × 3 = 90 litres.",scene:"🚰"},
    {mission:"Lay the park path",q:"A rectangle is 8 m long and 5 m wide. What is its area?",options:["13 m²","26 m²","40 m²","80 m²"],answer:2,hint:"Area = length × width.",fact:"8 × 5 = 40 square metres.",scene:"🌳"},
    {mission:"Balance the transport budget",q:"Three buses cost ₹250 each to run. What is the total?",options:["₹500","₹650","₹750","₹1,000"],answer:2,hint:"Multiply 250 by 3.",fact:"₹250 × 3 = ₹750.",scene:"🚌"},
    {mission:"BOSS: light the whole city",q:"Power use rose from 400 to 500 units. What was the percentage increase?",options:["10%","20%","25%","100%"],answer:2,hint:"The increase is 100 compared with the original 400.",fact:"100 ÷ 400 × 100 = 25%.",scene:"🌆"},
  ]},
  "Story Forge":{icon:"📖",name:"Story Forge",tagline:"Repair stories and forge powerful language.",color:"pink",verb:"FORGE",challenges:[
    {mission:"Open with a spark",q:"Which sentence is the strongest story hook?",options:["It was a day.","The door whispered my name at midnight.","I have a door.","Doors can open."],answer:1,hint:"Choose the line that creates an immediate question.",fact:"A vivid mystery makes the reader want to know what happens next.",scene:"🚪"},
    {mission:"Fix the time machine",q:"Choose the correct past-tense sentence.",options:["She run to the portal.","She ran to the portal.","She running to portal.","She runs yesterday."],answer:1,hint:"The past form of run is irregular.",fact:"‘Ran’ is the simple past form of ‘run’.",scene:"⏳"},
    {mission:"Sharpen the description",q:"Which verb makes this line most vivid: ‘The dragon ___ across the sky’?",options:["was","moved","soared","did"],answer:2,hint:"Pick the precise action word.",fact:"‘Soared’ conveys fast, high, graceful flight.",scene:"🐉"},
    {mission:"Repair the dialogue",q:"Which punctuation is correct?",options:["“Run”! shouted Mira.","“Run!” shouted Mira.","Run, shouted “Mira.”","“Run” shouted, Mira!"],answer:1,hint:"The exclamation belongs inside the quotation marks.",fact:"The spoken exclamation takes its punctuation before the closing quotation mark.",scene:"💬"},
    {mission:"BOSS: defeat the dull ending",q:"Which ending best shows rather than tells courage?",options:["Arun was brave.","Arun felt a thing.","His knees shook, but Arun stepped between the cub and the fire.","It ended bravely."],answer:2,hint:"Look for action and sensory detail.",fact:"Concrete action lets readers experience courage instead of merely being told.",scene:"🔥"},
  ]},
  Lab:{icon:"🔬",name:"Discovery Lab",tagline:"Observe, predict and test like a scientist.",color:"yellow",verb:"TEST",challenges:[
    {mission:"Design a fair plant test",q:"To test how light affects growth, what should you change?",options:["Only the amount of light","Light, water and soil together","The plant every hour","Nothing"],answer:0,hint:"A fair test changes one variable.",fact:"Changing only light helps isolate its effect on growth.",scene:"🪴"},
    {mission:"Read the thermometer",q:"Why should your eye be level with a liquid thermometer?",options:["To avoid parallax error","To warm the glass","To change the scale","To make it colourful"],answer:0,hint:"Viewing from an angle shifts the apparent reading.",fact:"Eye-level viewing prevents parallax and improves accuracy.",scene:"🌡️"},
    {mission:"Catch the hidden gas",q:"Which test identifies carbon dioxide?",options:["It turns limewater milky","It relights a glowing splint","It smells sweet","It freezes instantly"],answer:0,hint:"The gas reacts with limewater.",fact:"Carbon dioxide forms calcium carbonate, making limewater appear milky.",scene:"🧫"},
    {mission:"Measure a moving cart",q:"Speed is calculated as…",options:["distance ÷ time","time ÷ distance","distance + time","mass × colour"],answer:0,hint:"How far per unit of time?",fact:"Average speed equals total distance divided by total time.",scene:"🛒"},
    {mission:"BOSS: defend the conclusion",q:"Three trials give similar results. Why repeat an experiment?",options:["To improve reliability","To guarantee your guess","To remove every variable","To waste materials"],answer:0,hint:"Repeated evidence is more dependable.",fact:"Repeated trials reveal variation and make conclusions more reliable.",scene:"📊"},
  ]},
};

const C=(mission:string,q:string,options:string[],answer:number,hint:string,fact:string,scene:string):LoopChallenge=>({mission,q,options,answer,hint,fact,scene});
const CURRICULUM_GAME_PACKS:Record<string,{theme:GameTheme;challenges:LoopChallenge[]}>={
  "crop production and management":{theme:"Grower",challenges:[
    C("Prepare the field","Which tool loosens and turns the soil before sowing?",["Plough","Sickle","Sprinkler","Silo"],0,"It prepares soil for roots and air.","Ploughing loosens soil, improves aeration and helps roots grow deeply.","🚜"),
    C("Choose healthy seeds","Why are damaged seeds removed before sowing?",["They may not germinate well","They make more rain","They add nitrogen","They sharpen tools"],0,"Good crops begin with viable seeds.","Healthy, clean seeds improve germination and crop establishment.","🌾"),
    C("Feed the crop wisely","Which naturally improves soil with organic matter?",["Manure","Plastic","Kerosene","Detergent"],0,"It forms from decomposed plant and animal waste.","Manure adds humus and improves soil structure and water holding.","🪱"),
    C("Save every drop","Which irrigation method delivers water near individual roots?",["Drip irrigation","Flooding every field","Burning stubble","Winnowing"],0,"Water falls slowly through pipes.","Drip irrigation reduces water loss by supplying it close to roots.","💧"),
    C("BOSS: protect the harvest","Why must stored grains be kept dry?",["To prevent fungi and pests","To make them heavier","To remove nutrients","To increase weeds"],0,"Moisture helps unwanted organisms grow.","Dry, clean storage protects grain from microbial spoilage and insects.","🏚️"),
  ]},
  "microorganisms friend and foe":{theme:"Lab",challenges:[
    C("Start the curd culture","Which microorganism helps turn milk into curd?",["Lactobacillus","Plasmodium","Virus","Algae"],0,"It is a useful bacterium.","Lactobacillus produces acid that sets milk into curd.","🥛"),
    C("Make the dough rise","Yeast releases which gas during fermentation?",["Carbon dioxide","Nitrogen","Chlorine","Helium"],0,"Its bubbles make dough expand.","Yeast fermentation releases carbon dioxide, making dough rise.","🍞"),
    C("Stop an infection","Antibiotics are useful mainly against…",["Bacterial infections","Every virus","Broken bones","Vitamin deficiency"],0,"They target bacterial processes.","Antibiotics act against bacteria and should only be used as prescribed.","💊"),
    C("Break the disease chain","Which insect carries the malaria parasite?",["Female Anopheles mosquito","Housefly only","Honeybee","Silkworm"],0,"It bites mainly from dusk to dawn.","Female Anopheles mosquitoes transmit Plasmodium parasites.","🦟"),
    C("BOSS: preserve the milk","Pasteurisation makes milk safer by…",["Controlled heating then cooling","Adding soil","Freezing forever","Removing all water"],0,"It reduces harmful microbes without boiling for hours.","Pasteurisation uses controlled heat to destroy many harmful microorganisms.","🥛"),
  ]},
  "coal and petroleum":{theme:"Explorer",challenges:[
    C("Open the fossil vault","Coal, petroleum and natural gas are called…",["Fossil fuels","Solar cells","Metals","Biogas only"],0,"They formed from ancient organisms.","Fossil fuels formed from buried remains over millions of years.","⛏️"),
    C("Refine the crude oil","Where is petroleum separated into useful fractions?",["Refinery","Farm","Dam","Observatory"],0,"Crude oil is processed there.","A refinery separates crude petroleum into petrol, diesel, kerosene and other products.","🏭"),
    C("Use the clean flame","Which fossil fuel is commonly supplied as CNG?",["Natural gas","Coal tar","Coke","Bitumen"],0,"The letters mean compressed natural gas.","CNG burns more cleanly than coal or petrol in many uses.","🚌"),
    C("Protect a limited resource","Why are fossil fuels called exhaustible?",["Their reserves are finite","They regrow daily","They come from sunlight today","They cannot burn"],0,"They form far more slowly than we use them.","Fossil-fuel reserves can be depleted and take millions of years to form.","⏳"),
    C("BOSS: choose tomorrow’s energy","Which action conserves petroleum most directly?",["Use public transport","Idle engines longer","Burn plastic","Drive extra trips"],0,"Share one vehicle journey.","Public transport reduces fuel use per passenger.","🚇"),
  ]},
  "combustion and flame":{theme:"Mixer",challenges:[
    C("Light the safe burner","The lowest temperature at which a substance catches fire is its…",["Ignition temperature","Boiling point","Freezing point","Melting point"],0,"It is the fire-starting threshold.","A combustible material burns only after reaching its ignition temperature.","🔥"),
    C("Choose the fuel","A good fuel should have…",["High calorific value","Lots of smoke","Very low heat output","Difficult storage"],0,"It should release useful energy efficiently.","A good fuel gives substantial heat, burns controllably and creates little pollution.","⛽"),
    C("Read the candle flame","Which candle-flame zone is usually hottest?",["Outermost zone","Dark inner zone","Wick only","Smoke above it"],0,"Complete combustion occurs there.","The outermost zone has enough oxygen for complete combustion and is hottest.","🕯️"),
    C("Stop the oil fire","Why should water not be poured on burning cooking oil?",["Oil can float and spread","Water is fuel","Oil freezes instantly","It removes oxygen safely"],0,"The burning liquid stays above water.","Water may splash and spread burning oil; smothering is safer.","🧯"),
    C("BOSS: protect the air","Incomplete combustion may produce poisonous…",["Carbon monoxide","Oxygen","Water vapour only","Nitrogen"],0,"It binds strongly to haemoglobin.","Carbon monoxide forms when fuel burns with insufficient oxygen.","🚨"),
  ]},
  "conservation of plants and animals":{theme:"Grower",challenges:[
    C("Save the forest","Large-scale clearing of forests is called…",["Deforestation","Migration","Irrigation","Germination"],0,"It removes tree cover.","Deforestation destroys habitats and can increase erosion and climate impacts.","🌲"),
    C("Protect a whole ecosystem","A biosphere reserve conserves…",["Plants, animals and culture","Only one pet","Only roads","Only farm tools"],0,"It covers a large living landscape.","Biosphere reserves protect biodiversity and sustainable human relationships with nature.","🏞️"),
    C("Identify the rare resident","A species found naturally only in one region is…",["Endemic","Domestic","Migratory","Extinct"],0,"Its geographic range is limited.","Endemic species occur naturally in a particular area and nowhere else.","🦎"),
    C("Restore the canopy","Planting trees again in a cleared forest is…",["Reforestation","Refining","Fermentation","Filtration"],0,"It rebuilds tree cover.","Reforestation restores vegetation and supports soil, water and wildlife.","🌱"),
    C("BOSS: stop extinction","The Red Data Book records information about…",["Threatened species","Fuel prices","Weather only","School timetables"],0,"It tracks species at risk.","Red Data records help identify and monitor threatened plants and animals.","📕"),
  ]},
  "reproduction in animals":{theme:"Lab",challenges:[
    C("Join the cells","Fusion of sperm and ovum is called…",["Fertilisation","Budding","Metamorphosis","Incubation"],0,"It forms a zygote.","Fertilisation combines male and female gametes to form a zygote.","🧬"),
    C("Track development","The single cell formed after fertilisation is the…",["Zygote","Foetus","Larva","Bud"],0,"It is the first cell of a new organism.","The zygote divides repeatedly and develops into an embryo.","🔬"),
    C("Classify the animal","Animals that give birth to young ones are…",["Viviparous","Oviparous","Asexual only","Amphibious only"],0,"Humans and most mammals are examples.","Viviparous animals develop young inside the mother and give birth.","🐄"),
    C("Follow the frog","The change from tadpole to adult frog is…",["Metamorphosis","Pollination","Germination","Fermentation"],0,"Body form changes dramatically.","Metamorphosis transforms a larval stage into the adult form.","🐸"),
    C("BOSS: clone the sheep","Dolly was produced using a nucleus from a…",["Body cell","Pollen grain","Virus","Red blood cell without nucleus"],0,"The method used somatic-cell nuclear transfer.","Dolly was cloned using the nucleus of an adult somatic cell.","🐑"),
  ]},
  "reaching the age of adolescence":{theme:"Explorer",challenges:[
    C("Name the transition","The period between childhood and adulthood is…",["Adolescence","Infancy","Old age","Germination"],0,"It includes puberty.","Adolescence is a developmental transition involving physical and emotional change.","🌟"),
    C("Find the messengers","Chemical substances secreted by endocrine glands are…",["Hormones","Enzymes only","Vitamins","Antibiotics"],0,"They travel as body signals.","Hormones coordinate growth, development and many body functions.","📨"),
    C("Locate the master gland","Which gland helps regulate several other endocrine glands?",["Pituitary","Sweat gland","Salivary gland","Tear gland"],0,"It is often called the master gland.","The pituitary releases hormones that influence growth and other glands.","🧠"),
    C("Build a healthy routine","Adolescents especially need…",["Balanced diet and activity","Only sugar","No sleep","Unprescribed medicines"],0,"Growing bodies need varied nutrients and rest.","Balanced nutrition, hygiene, exercise and sleep support healthy development.","🥗"),
    C("BOSS: determine sex chromosomes","In humans, the ovum always contributes which sex chromosome?",["X","Y","Both X and Y","Neither"],0,"Every human ovum carries the same one.","The ovum carries X; the sperm contributes either X or Y.","🧬"),
  ]},
  "force and pressure":{theme:"Builder",challenges:ENDLESS_WORLDS.Builder.challenges},
  "friction":{theme:"Builder",challenges:[
    C("Grip the road","Friction acts in a direction that…",["Opposes relative motion","Always increases motion","Removes mass","Creates gravity"],0,"It resists sliding.","Friction opposes relative motion or the tendency to move between surfaces.","🛞"),
    C("Compare the surfaces","Which surface usually produces more friction?",["Rough road","Smooth ice","Oiled metal","Polished glass"],0,"More irregularities interlock.","Rough surfaces generally create greater friction than smooth surfaces.","🪨"),
    C("Move the crate","Which is usually smaller?",["Rolling friction","Sliding friction","Static friction maximum","All are always equal"],0,"Wheels make transport easier.","Rolling friction is usually less than sliding friction.","🛒"),
    C("Protect the machine","Lubricants reduce friction by…",["Separating rubbing surfaces","Making them rougher","Adding weight","Removing motion"],0,"They form a thin layer.","Lubricants reduce direct contact between surface irregularities.","🛢️"),
    C("BOSS: fall through air","The frictional force exerted by a fluid is called…",["Drag","Thrust only","Pressure only","Gravity"],0,"Air resistance is an example.","Drag opposes an object moving through air or liquid.","🪂"),
  ]},
  "sound":{theme:"Lab",challenges:[
    C("Create a note","Sound is produced by a…",["Vibrating object","Motionless vacuum","Shadow","Magnet only"],0,"A tuning fork visibly trembles.","Vibrations disturb a medium and create sound waves.","🎵"),
    C("Carry the sound","Sound cannot travel through…",["A vacuum","Air","Water","Steel"],0,"It needs particles to pass vibrations.","Mechanical sound waves require a material medium.","🌌"),
    C("Change the pitch","Higher vibration frequency produces…",["Higher pitch","Lower pitch","No sound","Greater mass"],0,"Frequency tells how fast vibration repeats.","Pitch increases as vibration frequency increases.","🎶"),
    C("Change the loudness","A larger vibration amplitude usually makes sound…",["Louder","Slower","Invisible","Lower in pitch only"],0,"Amplitude measures the size of vibration.","Greater amplitude transfers more energy and is heard as greater loudness.","📢"),
    C("BOSS: protect your ears","Long exposure to very loud sound can…",["Damage hearing","Improve every ear","Stop vibration forever","Create oxygen"],0,"Hair cells in the inner ear are delicate.","Excessive noise can permanently damage hearing, so volume and exposure time matter.","🎧"),
  ]},
  "chemical effects of electric current":{theme:"Mixer",challenges:[
    C("Test the liquid","A liquid that allows electric current to pass is a…",["Conductor","Perfect insulator","Magnet only","Fuel"],0,"Some solutions contain moving ions.","Conducting liquids carry current through charged particles.","💧"),
    C("Make the tester safer","Why can an LED be useful in a liquid tester?",["It glows with small current","It creates water","It needs no circuit","It stops all current"],0,"Weak currents may not heat a bulb filament.","LEDs can indicate small currents that may not light a filament bulb.","💡"),
    C("Watch the electrodes","Gas bubbles forming at electrodes show a…",["Chemical effect","Shadow effect","Gravitational effect","Sound reflection"],0,"The current causes a reaction.","Electric current through a solution can cause chemical change and gas formation.","🫧"),
    C("Coat the object","Depositing a metal layer using electricity is…",["Electroplating","Evaporation","Filtration","Distillation"],0,"Chrome coating is an example.","Electroplating uses electric current to deposit one metal on another object.","🥄"),
    C("BOSS: protect the bicycle","Chromium plating is used because chromium is…",["Shiny and corrosion-resistant","Very soft and soluble","A gas","A plastic"],0,"It improves appearance and protection.","A thin chromium layer resists corrosion without making the whole object from costly chromium.","🚲"),
  ]},
  "some natural phenomena":{theme:"Explorer",challenges:[
    C("Explain the spark","Lightning is a large…",["Electric discharge","Sound reflection","Water current","Magnetic rock"],0,"Charges build up in clouds.","Lightning occurs when accumulated electric charge suddenly discharges.","⚡"),
    C("Stay safe outside","During lightning, the safer choice is to…",["Enter a substantial building","Stand under an isolated tree","Hold a metal pole","Lie flat in water"],0,"Seek enclosed shelter.","A substantial building or closed vehicle provides safer shelter.","🏠"),
    C("Track the shaking","The point inside Earth where an earthquake begins is the…",["Focus","Epicentre","Crater","Pole"],0,"The epicentre lies above it.","The earthquake focus is underground; the epicentre is directly above on the surface.","🌍"),
    C("Measure the tremor","Earthquake waves are recorded by a…",["Seismograph","Thermometer","Barometer only","Microscope"],0,"It traces ground motion.","A seismograph detects and records seismic vibrations.","📈"),
    C("BOSS: survive the room","During strong shaking indoors, you should…",["Drop, cover and hold on","Use the lift","Run near windows","Stand under shelves"],0,"Protect your head from falling objects.","Drop, take cover under sturdy furniture and hold on until shaking stops.","🛡️"),
  ]},
  "light":{theme:"Lab",challenges:[
    C("Bounce the ray","The angle of reflection is equal to the angle of…",["Incidence","Refraction always","Dispersion","Rotation"],0,"Both angles are measured from the normal.","The law of reflection states angle of incidence equals angle of reflection.","🔦"),
    C("See the image","Regular reflection occurs mainly from a…",["Smooth surface","Very rough wall","Cloud of dust","Pile of sand"],0,"Parallel rays remain orderly.","A smooth surface reflects parallel rays in a regular pattern and forms a clear image.","🪞"),
    C("Build the pattern tube","A kaleidoscope works using…",["Multiple reflections","Only refraction","Sound waves","Gravity"],0,"Mirrors repeat coloured shapes.","Inclined mirrors create repeated symmetrical images by multiple reflection.","🔭"),
    C("Find the blind spot","The blind spot has no…",["Light-sensitive cells","Blood supply","Nerve connection","Lens"],0,"Rods and cones are absent there.","Where the optic nerve exits the retina there are no rods or cones.","👁️"),
    C("BOSS: read safely","Which habit protects eyesight?",["Use suitable light and distance","Stare at the Sun","Rub eyes with dirty hands","Read in a moving dark vehicle"],0,"Reduce strain and avoid injury.","Good lighting, proper distance, hygiene and never staring at the Sun protect eyes.","📖"),
  ]},
};
const normaliseChapter=(value:string)=>value.toLowerCase().replace(/[–—&]/g," ").replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ").trim();
function curriculumPackFor(board:string,grade:string,subject:string,chapter:string){
  if(board!=="CBSE"||grade!=="Class 8"||normaliseChapter(subject)!=="science")return undefined;
  const chapterKey=normaliseChapter(chapter);
  return chapterKey?CURRICULUM_GAME_PACKS[chapterKey]:undefined;
}

function EndlessGameLoop({theme,context,playerId,onClose,onReward}:{theme:GameTheme;context:GameContext;playerId:string;onClose:()=>void;onReward:(xp:number,coins:number)=>void}){
  const config=ENDLESS_WORLDS[theme];
  const curriculumPack=curriculumPackFor(context.board,context.grade,context.subject,context.chapter);
  const challenges=curriculumPack?.challenges||config.challenges;
  const [round,setRound]=useState(0);
  const [answer,setAnswer]=useState<number|null>(null);
  const [hearts,setHearts]=useState(5);
  const [combo,setCombo]=useState(0);
  const [runXp,setRunXp]=useState(0);
  const [runCoins,setRunCoins]=useState(0);
  const [bestCombo,setBestCombo]=useState(0);
  const [hint,setHint]=useState(false);
  const [hidden,setHidden]=useState<number[]>([]);
  const [fiftyUsed,setFiftyUsed]=useState(false);
  const [checkpoint,setCheckpoint]=useState(false);
  const [recovery,setRecovery]=useState(false);
  const [sound,setSound]=useState(true);
  const [seconds,setSeconds]=useState(0);
  const [lastRewardedRound,setLastRewardedRound]=useState(-1);
  const [loadedKey,setLoadedKey]=useState("");
  const saveKey=`zappy-loop-v3-${normaliseChapter(`${playerId}-${context.board}-${context.grade}-${context.subject}-${context.chapter}-${theme}`)}`;
  const world=Math.floor(round/5)+1;
  const step=round%5;
  const regularChallengeCount=Math.max(1,challenges.length-1);
  const challengeIndex=step===4?challenges.length-1:(step+world-1)%regularChallengeCount;
  const challenge=challenges[challengeIndex];
  const displayedOptions=useMemo(()=>{
    const shuffled=challenge.options.map((text,originalIndex)=>({text,originalIndex}));
    let seed=Array.from(`${challenge.q}-${round}-${context.chapter}`).reduce((total,char)=>(total*31+char.charCodeAt(0))>>>0,2166136261);
    for(let index=shuffled.length-1;index>0;index--){seed=(seed*1664525+1013904223)>>>0;const swap=seed%(index+1);[shuffled[index],shuffled[swap]]=[shuffled[swap],shuffled[index]]}
    return shuffled;
  },[challenge,round,context.chapter]);
  const correctAnswer=displayedOptions.findIndex(option=>option.originalIndex===challenge.answer);
  const isCorrect=answer===correctAnswer;
  const difficulty=world<3?"ROOKIE":world<6?"PRO":world<10?"ELITE":"LEGEND";

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      let savedRound=0,savedBest=0,savedReward=-1;
      const saved=localStorage.getItem(saveKey);
      if(saved){try{const data=JSON.parse(saved) as {round?:number;bestCombo?:number;lastRewardedRound?:number};savedRound=data.round||0;savedBest=data.bestCombo||0;savedReward=typeof data.lastRewardedRound==="number"?data.lastRewardedRound:-1}catch{}}
      setRound(savedRound);setBestCombo(savedBest);setLastRewardedRound(savedReward);setLoadedKey(saveKey);
    });
    return()=>{active=false};
  },[saveKey]);
  useEffect(()=>{if(loadedKey===saveKey)localStorage.setItem(saveKey,JSON.stringify({round,bestCombo,lastRewardedRound}))},[round,bestCombo,lastRewardedRound,saveKey,loadedKey]);
  useEffect(()=>{const timer=setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer)},[]);
  function tone(win:boolean){
    if(!sound)return;
    try{const context=new AudioContext();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.frequency.value=win?660:180;oscillator.type=win?"sine":"sawtooth";gain.gain.setValueAtTime(.07,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.28);oscillator.start();oscillator.stop(context.currentTime+.3);oscillator.onended=()=>context.close()}catch{}
  }
  function choose(index:number){
    if(answer!==null||hidden.includes(index))return;
    setAnswer(index);
    const win=index===correctAnswer;tone(win);
    if(win){
      const gained=100+world*15+combo*25;
      const coinGain=2+Math.min(5,combo);
      setRunXp(value=>value+gained);setRunCoins(value=>value+coinGain);setCombo(value=>{const next=value+1;setBestCombo(best=>Math.max(best,next));return next});
      if(round>lastRewardedRound){
        setLastRewardedRound(round);
        localStorage.setItem(saveKey,JSON.stringify({round,bestCombo,lastRewardedRound:round}));
        onReward(Math.ceil(gained/10),coinGain);
      }
    }else{
      setHearts(value=>Math.max(0,value-1));setCombo(0);
    }
  }
  function useFifty(){
    if(answer!==null||fiftyUsed)return;
    const wrong=displayedOptions.map((_,i)=>i).filter(i=>i!==correctAnswer).slice(0,2);
    setHidden(wrong);setFiftyUsed(true);
  }
  function advance(){
    if(!isCorrect){
      if(hearts<=0){setRecovery(true);return}
      setAnswer(null);setHidden([]);setHint(true);return;
    }
    if(step===4){setCheckpoint(true);return}
    setRound(value=>value+1);setAnswer(null);setHidden([]);setHint(false);
  }
  function nextWorld(){setRound(value=>value+1);setHearts(value=>Math.min(5,value+1));setAnswer(null);setHidden([]);setHint(false);setFiftyUsed(false);setCheckpoint(false)}
  function resume(){setHearts(3);setAnswer(null);setHidden([]);setHint(true);setRecovery(false)}
  const progress=((step+(answer!==null&&isCorrect?1:0))/5)*100;
  if(checkpoint)return <div className={`endless-backdrop ${config.color}`} role="dialog" aria-modal="true"><div className="endless-checkpoint"><div className="checkpoint-rays"/><span className="boss-crown">👑</span><small>WORLD {world} CHECKPOINT CLEARED</small><h1>{config.name} evolved!</h1><p>You mastered five challenges. The next world mixes concepts and raises the stakes.</p><div className="checkpoint-loot"><span><b>⚡ {runXp}</b>run score</span><span><b>🪙 {runCoins}</b>coins found</span><span><b>🔥 {bestCombo}</b>best combo</span></div><div className="world-evolve"><span>{config.icon}</span><i>→</i><span>{world%2?"✨":"⚡"}</span><div><b>WORLD {world+1}</b><small>{world+1<3?"New scenarios":world+1<6?"Mixed concepts":"Legend difficulty"}</small></div></div><button onClick={nextWorld}>ENTER WORLD {world+1} →</button><button className="healthy-exit" onClick={onClose}>SAVE RUN & TAKE A BREAK</button><small className="session-note">You’ve played {Math.floor(seconds/60)}m {seconds%60}s · your progress is saved</small></div></div>;
  if(recovery)return <div className={`endless-backdrop ${config.color}`} role="dialog" aria-modal="true"><div className="endless-checkpoint recovery"><span>🛠️</span><small>WORKSHOP CHECKPOINT</small><h1>Recharge, don’t restart.</h1><p>Your world and score are safe. Review the clue, restore three hearts, and rebuild this challenge.</p><div className="recovery-tip"><b>💡 What to notice</b><p>{challenge.fact}</p></div><button onClick={resume}>❤️ RESTORE 3 HEARTS & CONTINUE</button><button className="healthy-exit" onClick={onClose}>SAVE RUN & STOP FOR NOW</button></div></div>;
  return <div className={`endless-backdrop ${config.color}`} role="dialog" aria-modal="true" aria-label={`${config.name} endless learning game`}>
    <div className="endless-game">
      <header><button onClick={onClose} aria-label="Save and exit">×</button><div className="world-id"><span>{config.icon}</span><div><small>WORLD {world} · {difficulty}</small><b>{config.name}</b></div></div><div className="boss-track"><span><i style={{width:`${progress}%`}}/></span><small>{step===4?"BOSS CHALLENGE":`${5-step} TO BOSS`}</small></div><div className="run-stats"><b>🔥 {combo}x</b><b>⚡ {runXp}</b><b>🪙 {runCoins}</b><span>{Array.from({length:5},(_,i)=><i key={i}>{i<hearts?"❤️":"🖤"}</i>)}</span><button onClick={()=>setSound(value=>!value)}>{sound?"🔊":"🔇"}</button></div></header>
      <main>
        <section className={`endless-scene ${answer!==null?(isCorrect?"victory":"impact"):""} ${step===4?"boss":""}`}>
          <div className="scene-sky"><i/><i/><i/></div><span className="scene-world-icon">{config.icon}</span><span className="scene-mission-icon">{challenge.scene}</span><div className="scene-ground"/><div className="scene-energy">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>
          {answer!==null&&isCorrect&&<div className="game-confetti">{Array.from({length:18},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%6)*.08}s`,background:["#58cc02","#ffd84d","#ce82ff","#1cb0f6"][i%4]}}/>)}</div>}
          <div className="mission-banner"><small>{step===4?"⚠️ BOSS MISSION":`MISSION ${step+1} OF 5`}</small><b>{challenge.mission}</b></div>
          {combo>=2&&<div className="combo-float">🔥 {combo}x COMBO</div>}
        </section>
        <section className="endless-play-panel">
          <div className="zappy-coach"><span>⚡</span><p><b>{answer===null?`${config.verb} YOUR NEXT MOVE`:isCorrect?"World upgraded!":"The world reacted—study what changed."}</b><small>{answer===null?"Choose, test, and learn from the consequence.":challenge.fact}</small></p></div>
          <div className="challenge-card"><small>{context.board.toUpperCase()} · {context.grade.toUpperCase()} · {context.subject.toUpperCase()} · {context.chapter.toUpperCase()}</small><h2>{challenge.q}</h2>{hint&&<p>💡 {challenge.hint}</p>}</div>
          <div className="endless-options">{displayedOptions.map((option,index)=><button key={`${option.originalIndex}-${option.text}`} hidden={hidden.includes(index)} className={answer===null?"":index===correctAnswer?"correct":index===answer?"wrong":"dim"} onClick={()=>choose(index)}><span>{String.fromCharCode(65+index)}</span><b>{option.text}</b>{answer!==null&&index===correctAnswer&&<i>✓</i>}{answer===index&&index!==correctAnswer&&<i>×</i>}</button>)}</div>
          {answer===null?<div className="power-row"><button onClick={()=>setHint(value=>!value)} className={hint?"used":""}>💡 {hint?"HINT OPEN":"HINT"}</button><button onClick={useFifty} disabled={fiftyUsed}>✨ {fiftyUsed?"50/50 USED":"50/50"}</button><span>Every answer changes the world—mistakes become retries.</span></div>:<div className={`endless-feedback ${isCorrect?"win":"learn"}`}><span>{isCorrect?"🎉":"🧠"}</span><div><b>{isCorrect?`Perfect move! +${100+world*15+(combo-1)*25} points`:"That choice changed the world."}</b><p>{challenge.fact}</p></div><button onClick={advance}>{isCorrect?(step===4?"OPEN BOSS CHEST →":"NEXT MISSION →"):hearts<=0?"WORKSHOP BREAK →":"REBUILD & RETRY →"}</button></div>}
        </section>
      </main>
      <footer><span>Round {round+1} · progress saves at every world</span><button onClick={onClose}>⏸ SAVE & EXIT</button><span>Healthy checkpoint every 5 challenges</span></footer>
    </div>
  </div>;
}

type GameStage = "select" | "chapters" | "levels" | "quiz" | "complete" | "gameover" | "plant";
const gameQuestions = [
  { q:"Which force pulls every object toward Earth?", hint:"It keeps your feet on the ground.", options:["Friction","Gravity","Magnetism","Push"], answer:1, fact:"Gravity pulls everything with mass toward Earth." },
  { q:"What happens when balanced forces act on a stationary object?", hint:"Both sides pull equally.", options:["It stays still","It spins","It melts","It disappears"], answer:0, fact:"Equal opposite forces cancel each other." },
  { q:"Which surface creates the most friction?", hint:"Think rough versus smooth.", options:["Ice","Polished glass","Rough road","Wet tile"], answer:2, fact:"Rough surfaces have more irregularities that resist motion." },
  { q:"Pushing a trolley harder usually makes it…", hint:"More force changes motion.", options:["Move faster","Lose mass","Change colour","Float"], answer:0, fact:"A greater unbalanced force produces greater acceleration." },
  { q:"Why does a bicycle slow after you stop pedalling?", hint:"A force opposes motion.", options:["Gravity vanishes","Friction and air resistance","The wheels grow","Its mass decreases"], answer:1, fact:"Friction and air resistance remove the bicycle’s motion energy." },
];
const plantLevels = [
  {name:"What does a plant need?",q:"Which one does a plant NOT need to make food?",options:["☀️ Sunlight","💧 Water","🍕 Pizza","💨 Carbon dioxide"],a:2,xp:15,fact:"Plants make food from sunlight, water and carbon dioxide.",stage:"🌱"},
  {name:"Where does water come from?",q:"How does water travel from soil into a plant?",options:["🍃 Leaves","🌸 Flowers","🌿 Roots","🌞 Sunlight"],a:2,xp:15,fact:"Roots act like tiny drinking straws and xylem carries water upward.",stage:"🌿"},
  {name:"What is photosynthesis?",q:"What does a plant produce during photosynthesis?",options:["🍎 Fruits only","🌬️ Oxygen + glucose","💧 More water","🌡️ Heat"],a:1,xp:15,fact:"Plants produce oxygen for us and glucose for themselves.",stage:"🪴"},
  {name:"Where does the magic happen?",q:"Which cell structure captures sunlight?",options:["🌱 Root cells","💚 Chloroplasts","🌸 Petals","🪵 Bark"],a:1,xp:15,fact:"Chloroplasts contain green chlorophyll that captures light.",stage:"🌳"},
  {name:"The big formula",q:"Which is the photosynthesis equation?",options:["CO₂ + H₂O + light → glucose + O₂","Food + water → energy","Water + soil → food","Heat + air → CO₂"],a:0,xp:15,fact:"Every food chain begins with energy captured by photosynthesis.",stage:"🌸"},
];

function GameUniverse(){
  const [stage,setStage]=useState<GameStage>("select");
  const [board,setBoard]=useState("CBSE");
  const [grade,setGrade]=useState(4);
  const [subject,setSubject]=useState("Science");
  const [chapter,setChapter]=useState("Force & Motion");
  const [level,setLevel]=useState(1);
  const [difficulty,setDifficulty]=useState("Easy");
  const [qIndex,setQIndex]=useState(0);
  const [hearts,setHearts]=useState(5);
  const [xp,setXp]=useState(0);
  const [correct,setCorrect]=useState(0);
  const [chosen,setChosen]=useState<number|null>(null);
  const [plantIndex,setPlantIndex]=useState(0);
  const [plantHearts,setPlantHearts]=useState(3);
  const [plantXp,setPlantXp]=useState(0);
  const chapters = subject==="Science" ? [["🌿","Plants — Food Makers"],["🔍","Animal Adaptations"],["⚙️","Teeth & Digestion"],["🌉","Force & Motion"],["🔋","Work & Energy"],["🌍","Our Environment"]] : subject==="Mathematics" ? [["🔢","Large Numbers"],["🍕","Fractions"],["🔷","Geometry"],["📊","Data Handling"],["💰","Money"],["📏","Measurement"]] : [["📖","Comprehension"],["✏️","Tenses"],["📝","Writing"],["🔤","Vocabulary"]];
  const diff = {Easy:{hearts:5,xp:5,qs:3},Medium:{hearts:4,xp:10,qs:4},Hard:{hearts:3,xp:15,qs:5},Expert:{hearts:3,xp:25,qs:5}}[difficulty as "Easy"];
  function startQuiz(){setQIndex(0);setHearts(diff.hearts);setXp(0);setCorrect(0);setChosen(null);setStage("quiz")}
  function answerQuiz(i:number){if(chosen!==null)return;setChosen(i);if(i===gameQuestions[qIndex].answer){setXp(v=>v+diff.xp);setCorrect(v=>v+1)}else setHearts(v=>v-1)}
  function nextQuiz(){if(hearts<=0){setStage("gameover");return}const total=diff.qs;if(qIndex+1>=total){setStage("complete");return}setQIndex(v=>v+1);setChosen(null)}
  function answerPlant(i:number){if(chosen!==null)return;setChosen(i);if(i===plantLevels[plantIndex].a)setPlantXp(v=>v+15);else setPlantHearts(v=>v-1)}
  function nextPlant(){if(plantHearts<=0){setStage("gameover");return}if(plantIndex===plantLevels.length-1){setStage("complete");return}setPlantIndex(v=>v+1);setChosen(null)}
  if(stage==="select")return <div className="game-universe select"><header><span>⚡</span><div><h2>Zappy Game Engine</h2><p>Infinite curriculum games for every board, class and subject.</p></div></header><div className="game-select-grid"><section><h3>📋 Select Board</h3><div>{["CBSE","ICSE","Karnataka","Maharashtra"].map(x=><button className={board===x?"on":""} onClick={()=>setBoard(x)} key={x}>{x==="CBSE"?"🇮🇳":x==="ICSE"?"📚":"🏫"}<b>{x}</b></button>)}</div></section><section><h3>🏫 Select Class</h3><div>{[1,2,3,4,5,6,7,8].map(x=><button className={grade===x?"on":""} onClick={()=>setGrade(x)} key={x}><span>{x}</span><b>Class {x}</b></button>)}</div></section><section className="subject-select"><h3>📖 Select Subject</h3><div>{["Science","Mathematics","English","Social Studies","EVS","Hindi","Computer Science","General Knowledge"].map(x=><button className={subject===x?"on":""} onClick={()=>setSubject(x)} key={x}>{x}</button>)}</div></section></div><div className="game-start-row"><div><b>{board} · Class {grade} · {subject}</b><small>Fresh AI challenges · difficulty scales forever</small></div><button onClick={()=>setStage("chapters")}>EXPLORE CHAPTERS →</button></div></div>;
  if(stage==="chapters")return <div className="game-universe"><div className="game-back"><button onClick={()=>setStage("select")}>←</button><div><h2>Class {grade} · {subject}</h2><p>{board} curriculum · choose any chapter</p></div></div><div className="chapter-map">{chapters.map((c,i)=><button key={c[1]} className={i===3?"current":i<3?"done":""} onClick={()=>{setChapter(c[1]);if(c[1].includes("Plants"))setStage("plant");else setStage("levels")}}><span>{c[0]}</span><div><h3>{c[1]}</h3><p>Chapter {i+1} · 100+ levels</p><i>{[0,1,2,3,4].map(d=><em className={d<i%5?"on":""} key={d}/>)}</i></div><b>{i<3?"★★★":i===3?"★☆☆":"☆☆☆"}</b></button>)}</div></div>;
  if(stage==="levels")return <div className="game-universe"><div className="game-back"><button onClick={()=>setStage("chapters")}>←</button><div><h2>{chapter}</h2><p>{board} · Class {grade} · {subject}</p></div></div><div className="level-track">{Array.from({length:12},(_,i)=><button className={level===i+1?"current":i+1<level?"done":""} onClick={()=>setLevel(i+1)} key={i}>{i+1}<small>{i+1<level?"★★★":level===i+1?"▶":"🔒"}</small></button>)}</div><h3 className="choose-diff">Choose your challenge</h3><div className="difficulty-grid">{[["🌱","Easy","Basic recall","+5 XP"],["🔥","Medium","Application","+10 XP"],["⚡","Hard","Multi-step reasoning","+15 XP"],["💎","Expert","Olympiad level","+25 XP"]].map(x=><button className={difficulty===x[1]?"on":""} onClick={()=>setDifficulty(x[1])} key={x[1]}><span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p><small>{x[3]} per question</small></button>)}</div><button className="launch-level" onClick={startQuiz}>⚡ START LEVEL {level}</button></div>;
  if(stage==="plant"){const p=plantLevels[plantIndex];return <div className="plant-game"><header><button onClick={()=>setStage("chapters")}>×</button><div><i style={{width:(plantIndex/5*100)+"%"}}/></div><b>+{plantXp} XP</b><span>{Array.from({length:3},(_,i)=>i<plantHearts?"❤️":"🖤")}</span></header><div className="plant-level"><b>Level {plantIndex+1} of 5</b><span>{p.name}</span></div><div className="plant-scene"><span className="sun-anim">☀️</span><span className="cloud-anim">☁️</span><div className="growing-plant" style={{fontSize:(38+plantIndex*13)+"px"}}>{chosen===p.a?p.stage:plantIndex===0?"🪴":plantLevels[Math.max(0,plantIndex-1)].stage}</div><div className="ground-line"/></div><div className="plant-question"><span>⚡</span><div><h2>{p.q}</h2><p>Grow the plant with the right science choice.</p></div></div><div className="plant-choices">{p.options.map((x,i)=><button className={chosen===null?"":i===p.a?"correct":chosen===i?"wrong":"dim"} onClick={()=>answerPlant(i)} key={x}>{x}</button>)}</div>{chosen!==null&&<div className={chosen===p.a?"game-feedback win":"game-feedback lose"}><span>{chosen===p.a?"🎉":"💡"}</span><div><b>{chosen===p.a?"Amazing! The plant grew.":"Not quite—learn and retry."}</b><p>{p.fact}</p></div><button onClick={chosen===p.a?nextPlant:()=>setChosen(null)}>{chosen===p.a?"NEXT →":"TRY AGAIN"}</button></div>}</div>}
  if(stage==="quiz"){const q=gameQuestions[qIndex];return <div className="quiz-game"><header><button onClick={()=>setStage("levels")}>×</button><div><i style={{width:(qIndex/diff.qs*100)+"%"}}/></div><span>{Array.from({length:diff.hearts},(_,i)=>i<hearts?"❤️":"🖤")}</span><b>+{xp} XP</b></header><div className="quiz-scene"><span>{chapter.includes("Force")?"🌉":"🔬"}</span><i>Level {level}</i><em>{difficulty}</em></div><div className="quiz-card"><small>QUESTION {qIndex+1} OF {diff.qs}</small><h2>{q.q}</h2><p>💡 {q.hint}</p></div><div className="quiz-options">{q.options.map((x,i)=><button className={chosen===null?"":i===q.answer?"correct":chosen===i?"wrong":"dim"} onClick={()=>answerQuiz(i)} key={x}><span>{String.fromCharCode(65+i)}</span>{x}</button>)}</div>{chosen!==null&&<div className={chosen===q.answer?"game-feedback win":"game-feedback lose"}><span>{chosen===q.answer?"🎉":"💔"}</span><div><b>{chosen===q.answer?`Brilliant! +${diff.xp} XP`:"Not quite!"}</b><p>{q.fact}</p></div><button onClick={nextQuiz}>NEXT →</button></div>}</div>}
  if(stage==="gameover")return <div className="game-end lose"><span>🥀</span><h1>No lives left!</h1><p>Every mistake is a lesson. Your next attempt will be stronger.</p><div><b>💡 Quick tip</b><p>Review the hint before choosing. Look for the option that explains why—not only what.</p></div><button onClick={()=>chapter.includes("Plant")?setStage("plant"):startQuiz()}>🔄 TRY AGAIN</button><button onClick={()=>setStage("levels")}>CHOOSE ANOTHER LEVEL</button></div>;
  return <div className="game-end"><span>🏆</span><h1>{chapter.includes("Plant")?"Plant Kingdom mastered!":`Level ${level} complete!`}</h1><div className="end-stars">{correct/diff.qs>=.8||plantXp>=60?"★★★":"★★☆"}</div><p>Amazing work—your challenge gets harder from here.</p><div className="end-stats"><span><b>{chapter.includes("Plant")?plantXp:xp}</b>XP earned</span><span><b>{chapter.includes("Plant")?`${plantIndex+1}/5`:`${correct}/${diff.qs}`}</b>Correct</span><span><b>{hearts}</b>Hearts left</span></div><button onClick={()=>{setLevel(v=>v+1);setStage("levels")}}>PLAY NEXT LEVEL →</button><button onClick={()=>setStage("chapters")}>BACK TO CHAPTERS</button></div>;
}

function ModuleShell({title,tabs,tab,setTab,children}:{title:string;tabs:string[];tab:number;setTab:(i:number)=>void;children:React.ReactNode}){return <div className="module-shell"><div className="module-toolbar"><h3>{title}</h3><nav>{tabs.map((x,i)=><button className={tab===i?"active":""} onClick={()=>setTab(i)} key={x}>{x}</button>)}</nav><button>⋯</button></div><div className="module-content">{children}</div></div>}

function LoginScreen({ role, setRole, onLogin }: { role: Role; setRole: (role: Role) => void; onLogin: () => void }) {
  const data = {
    child: { icon: "👦", title: "I’m a learner", text: "Play, learn, build streaks, and level up." },
    teacher: { icon: "👩‍🏫", title: "I’m a teacher", text: "Manage classes, assign games, and see insights." },
    parent: { icon: "👨‍👩‍👧", title: "I’m a parent", text: "Link children, track progress, and create practice." },
  };
  return <main className="login-page">
    <section className="login-art">
      <div className="login-logo"><span className="bolt">ϟ</span>ZAPPY</div>
      <div className="login-copy"><span className="pill">ONE APP · EVERY LEARNER</span><h1>Play. Learn.<br/>Level up.</h1><p>School becomes a world of games, AI-powered quests, and real-life skills.</p></div>
      <div className="login-mascot"><Mascot/><span className="float-card fc1">🔥 14 day streak</span><span className="float-card fc2">⚡ +20 XP</span><span className="float-card fc3">🏆 Level up!</span></div>
      <small>Built for children, teachers, and parents—together.</small>
    </section>
    <section className="login-panel">
      <div className="login-box">
        <div className="mobile-login-logo"><span className="bolt">ϟ</span>ZAPPY</div>
        <span className="tiny-label">WELCOME TO ZAPPY</span>
        <h2>Choose your experience</h2>
        <p className="login-sub">Local pilot role preview. These fields do not authenticate an account yet.</p>
        <div className="role-options">
          {(Object.keys(data) as Role[]).map((item) => <button key={item} className={role === item ? "active" : ""} onClick={() => setRole(item)}><span>{data[item].icon}</span><div><b>{data[item].title}</b><small>{data[item].text}</small></div><i>{role === item ? "✓" : "›"}</i></button>)}
        </div>
        <label>Zappy ID or email<input defaultValue={role === "child" ? "@arjun_zappy" : role === "teacher" ? "@mssharma_zappy" : "@priya_zappy"} /></label>
        <label>Password<div className="password-field"><input type="password" defaultValue="zappydemo"/><button type="button" aria-label="Show password">◉</button></div></label>
        <button className="login-button" onClick={onLogin}>ENTER LOCAL DEMO AS {role.toUpperCase()}</button>
        <button className="create-account">CREATE A NEW ZAPPY ID</button>
        <div className="login-divider"><span>or continue with</span></div>
        <div className="social-login"><button>G&nbsp; Google</button><button>&nbsp; Apple</button></div>
        <small className="legal">By continuing, you agree to Zappy’s Terms and Child Safety Policy.</small>
      </div>
    </section>
  </main>;
}

function TeacherView({ view, tenant, actorId, setModal }: { view: View; tenant: string; actorId: string; setModal: (m: Modal) => void }) {
  if (view === "games") return <><button className="iqp-launcher" onClick={() => setModal("questions")}><span>🎯</span><div><small>QUESTION PAPER EVIDENCE</small><h2>Connect official papers before predicting</h2><p>Add five or more verified exam years, preserve every paper citation, then calculate recurrence. Forecasts remain locked without a calibrated model.</p><b>OPEN EVIDENCE WORKSPACE →</b></div><i>🔒<small>locked honestly</small></i></button><div className="assignment-hero"><div><span className="pill">SOURCE-CITED CREATOR</span><h2>Prepare and assign from today’s exact module</h2><p>The Teacher AI omits expected answers from the student copy, saves a source-cited quest, and waits for real submissions. This local demo does not provide account security.</p><button onClick={() => setModal("ai")}>OPEN ASSIGNMENT WORKSPACE →</button></div><span>📋</span></div><TeacherLearningProofSummary key={`${actorId}-${tenant}`} actorId={actorId} workspace={tenant} onOpen={()=>setModal("ai")}/></>;
  if (view === "arena") return <section className="pilot-boundary-card"><span>🏫</span><div><small>{tenant.toUpperCase()} · LOCAL PILOT</small><h2>Class roster verification comes next</h2><p>Teacher-confirmed local Zappy IDs work for this pilot. Zappy will not invent class sizes, attendance, or student accounts before authenticated school data is connected.</p><button onClick={()=>setModal("ai")}>OPEN CONFIRMED ROSTER →</button></div></section>;
  if (view === "league") return <TeacherLearningProofSummary key={`${actorId}-${tenant}`} actorId={actorId} workspace={tenant} onOpen={()=>setModal("ai")}/>;
  return <RoleProfile icon="👩‍🏫" name="Ms. Sharma" id="@mssharma_zappy" role="Teacher account" details={["Local pilot workspace","Source-cited preparation enabled","Student activity requires explicit submission"]}/>;
}

function ParentView({ view, parentId, parentName, child, setModal }: { view: View; parentId: string; parentName: string; child: { name: string; id: string }; setModal: (m: Modal) => void }) {
  if (view === "learn" || view === "league") return <><ParentLearningDiary key={`${parentId}-${child.id}`} parentId={parentId} parentName={parentName} child={child} onOpenSource={()=>setModal("notebook")}/><button className="parent-predictor" onClick={() => setModal("questions")}><span>🎯</span><div><small>EXAM EVIDENCE CHECK</small><b>Important-question predictions are locked</b><p>Five or more verified official paper years are required for recurrence; a calibrated model is required for probability.</p></div><em>REVIEW PAPER COVERAGE →</em></button></>;
  if (view === "games") return <section className="pilot-boundary-card parent"><span>✍️</span><div><small>FAMILY SUPPORT · PILOT</small><h2>Use the real diary before assigning more</h2><p>Practice packs will be created from reviewed learning gaps—not fabricated mastery scores or generic recommendations.</p><button onClick={()=>setModal("ai")}>OPEN TODAY’S FAMILY GUIDE →</button></div></section>;
  if (view === "arena") return <section className="pilot-boundary-card parent"><span>👨‍👩‍👧</span><div><small>SELECTED LOCAL CHILD LINK</small><h2>{child.name}</h2><p>{child.id} · same-browser link. Account ownership and school enrollment are not verified in this pilot.</p></div></section>;
  return <RoleProfile icon="👩" name={parentName} id={parentId} role="Parent account" details={[`${child.name} selected locally`,"Daily diary uses explicit learning proofs","Letters require parent review before sending"]}/>;
}

function Metric({ icon, value, label, note }: { icon: string; value: string; label: string; note: string }) { return <div className="metric"><span>{icon}</span><div><b>{value}</b><small>{label}</small><em>{note}</em></div></div>; }
function RoleProfile({icon,name,id,role,details}:{icon:string;name:string;id:string;role:string;details:string[]}){return <><div className="profile-card role-profile"><div className="big-avatar">{icon}</div><div><span className="pill">{role.toUpperCase()}</span><h2>{name}</h2><p>{id} · Independent Zappy ID</p><button>EDIT PROFILE</button></div></div><div className="profile-settings">{details.map(x=><div key={x}><span>✓</span><b>{x}</b></div>)}<button>Privacy & account settings <span>›</span></button></div></>}

function Nav({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><b>{label}</b></button>;
}

function Mascot({ small = false }: { small?: boolean }) {
  return <div className={`mascot ${small ? "small" : ""}`}><i className="ear left"/><i className="ear right"/><span className="eye left">•</span><span className="eye right">•</span><b>⌣</b><em>ϟ</em></div>;
}

function GamesView({onPlay}:{onPlay:(theme:GameTheme,context:GameContext)=>void}) {
  const [board,setBoard]=useState("CBSE");
  const [grade,setGrade]=useState("Class 8");
  const [subject,setSubject]=useState("Science");
  const [chapter,setChapter]=useState("FORCE AND PRESSURE");
  const boards=BOARD_OPTIONS;
  const subjects=curriculumSubjects(board,grade);
  const curriculum=curriculumFor(board,grade,subject);
  const realChapters=curriculum?.chapters||[];
  const readyChapters=[...new Set(realChapters.filter(item=>Boolean(curriculumPackFor(board,grade,subject,item))))];
  const pack=curriculumPackFor(board,grade,subject,chapter);
  const displayBook=pack?CBSE8_SCIENCE_TEXTBOOK.book:curriculum?.book;
  const displaySource=pack?CBSE8_SCIENCE_TEXTBOOK.source:curriculum?.source;
  function context():GameContext{return {board,grade,subject,chapter,book:displayBook||"DIKSHA textbook",source:displaySource||"https://diksha.gov.in/"}}
  function chooseFor(nextBoard:string,nextGrade:string,nextSubject?:string){
    const available=curriculumSubjects(nextBoard,nextGrade);
    const chosen=nextSubject&&available.includes(nextSubject)?nextSubject:available.find(item=>item.toLowerCase()==="science")||available[0]||"";
    const record=curriculumFor(nextBoard,nextGrade,chosen);
    const first=(record?.chapters||[]).find(item=>Boolean(curriculumPackFor(nextBoard,nextGrade,chosen,item)))||"";
    setSubject(chosen);setChapter(first);
  }
  return <>
    <p className="lead">Choose the learner’s real textbook chapter first. Zappy only launches a game when that exact board, class, subject, and chapter pack is connected.</p>
    <section className="curriculum-game-launcher">
      <header><span>📚</span><div><small>EXACT-CHAPTER GAME PREVIEW</small><h2>Textbook → chapter → playable world</h2><p>Every mission is attached to the exact selected chapter. Source-citation review is still required before Zappy labels a pack textbook-grounded.</p></div><b>{readyChapters.length}<small>packs ready</small></b></header>
      <div className="game-context-selectors">
        <label>Board<select value={board} onChange={event=>{const value=event.target.value;setBoard(value);chooseFor(value,grade)}}>{boards.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Class<select value={grade} onChange={event=>{const value=event.target.value;setGrade(value);chooseFor(board,value)}}>{GRADE_OPTIONS.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Subject<select value={subject} disabled={!subjects.length} onChange={event=>{const value=event.target.value;setSubject(value);const record=curriculumFor(board,grade,value);setChapter((record?.chapters||[]).find(item=>Boolean(curriculumPackFor(board,grade,value,item)))||"")}}>{subjects.length?subjects.map(item=><option key={item}>{item}</option>):<option value="">No subjects imported</option>}</select></label>
        <label>Real textbook chapter<select value={chapter} onChange={event=>setChapter(event.target.value)} disabled={!readyChapters.length}>{readyChapters.length?readyChapters.map(item=><option key={item}>{item}</option>):<option value="">No exact game pack yet</option>}</select></label>
      </div>
      <div className="game-source-row">
        <div><span>{pack?"✓ EXACT CHAPTER-TAGGED PACK":curriculum?"CURRICULUM FOUND · GAME AUTHORING PENDING":"NO CURRICULUM RECORD FOR THIS PATH"}</span><b>{displayBook||"Select another board, class, or subject"}</b><small>{readyChapters.length} of {realChapters.length} imported chapter nodes have preview packs · citation review pending</small></div>
        {displaySource&&<span className="game-source-internal">🛡️ SOURCE STAYS IN ZAPPY</span>}
        <button disabled={!pack} onClick={()=>pack&&onPlay(pack.theme,context())}>{pack?`PLAY ${pack.theme.toUpperCase()} PACK →`:"EXACT GAME PACK REQUIRED"}</button>
      </div>
    </section>
    <div className="game-section-title"><div><small>CHOOSE THE PLAY STYLE</small><h2>{chapter||"Select a game-ready chapter"}</h2></div>{pack&&<span>Recommended: {ENDLESS_WORLDS[pack.theme].icon} {pack.theme}</span>}</div>
    <div className="game-grid">{games.map(g=><button disabled={!pack} className={`game-card ${g.color} ${pack?.theme===g.title?"recommended":""}`} key={g.title} onClick={()=>pack&&onPlay(g.title as GameTheme,context())}><span>{g.icon}</span><div><h3>{g.title}</h3><p>{g.text}</p><small>{pack?`${pack.theme===g.title?"★ RECOMMENDED · ":""}PLAY CHAPTER PACK →`:"CHAPTER PACK NOT READY"}</small></div></button>)}</div>
  </>;
}

const ARENA_EDUCATION:Record<ArenaSkill,{icon:string;name:string;promise:string;lesson:string;check:string;stages:string[]}>={
  public:{icon:"🎙️",name:"Public Speaking",promise:"Turn one idea into a message people can follow and remember.",lesson:"A strong talk travels through four beats: hook, clear point, proof, and a final line. Master the structure first; polish delivery one signal at a time.",check:"Can you state the whole message in one sentence?",stages:["Clear idea","Strong structure","Audience control","Stage ready"]},
  vlog:{icon:"🎬",name:"Vlogging",promise:"Create useful, camera-ready stories without copying another creator.",lesson:"A useful vlog earns attention with a promise, delivers one visible payoff, then closes cleanly. Camera energy supports the value—it never replaces it.",check:"What useful result will the viewer get?",stages:["Useful hook","Visible payoff","Camera rhythm","Creator ready"]},
  leadership:{icon:"👑",name:"Leadership",promise:"Help a team understand the goal, contribute, and act together.",lesson:"Leadership communication makes the goal, reason, roles, and next check-in clear. Strong leaders also leave space for questions and better ideas.",check:"Does every teammate know the next action?",stages:["Clear goal","Shared roles","Calm decisions","Team ready"]},
  social:{icon:"🤝",name:"Social Confidence",promise:"Start, sustain, and close conversations with respect.",lesson:"Connection is a learnable loop: open from the shared context, ask one real question, listen fully, and reflect one detail back.",check:"Is your next question based on what they said?",stages:["Warm opening","Real question","Active listening","Connection ready"]},
  mindfulness:{icon:"🧘",name:"Mindful Communication",promise:"Guide a short focus reset with clear, optional, calming cues.",lesson:"Mindful guidance should be simple, voluntary, audible, and time-bounded. Zappy evaluates delivery signals—not emotion, appearance, or how calm someone looks.",check:"Can the listener choose whether to participate?",stages:["Simple cue","Steady pace","Clear boundary","Guide ready"]},
};

function ArenaView({actorId,tenant,revision,skillId,onSelectSkill,onOpen}:{actorId:string;tenant:string;revision:number;skillId:ArenaSkill;onSelectSkill:(skill:ArenaSkill)=>void;onOpen:(skill:ArenaSkill,scope:ArenaEntryScope)=>void}){
  const [arenaState,setArenaState]=useState<SkillsArenaState>(()=>createSkillsArenaState({actorId,tenant}));
  const [scope,setScope]=useState<CompetitionScope>("class");
  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      const key=skillsArenaStorageKey(actorId,tenant);
      setArenaState(parseSkillsArenaState(window.localStorage.getItem(key),{actorId,tenant})||createSkillsArenaState({actorId,tenant}));
    });
    return()=>{active=false};
  },[actorId,tenant,revision]);

  const education=ARENA_EDUCATION[skillId];
  const attempts=arenaState.attempts.filter(attempt=>attempt.skill===skillId);
  const rankableAttempts=attempts.filter(attempt=>countMeasuredSignals(attempt.signals)>=3&&attempt.overallScore!==null);
  const latest=rankableAttempts.at(-1)||null;
  const first=rankableAttempts[0]||null;
  const signals=latest?.signals||{script:null,pace:null,timing:null,voice:null};
  const coach=getWeakestSignalCoaching(skillId,signals);
  const bestScore=rankableAttempts.reduce<number|null>((best,attempt)=>attempt.overallScore===null?best:best===null?attempt.overallScore:Math.max(best,attempt.overallScore),null);
  const improvement=latest?.overallScore!==null&&first?.overallScore!==null&&latest&&first?latest.overallScore-first.overallScore:null;
  const microWins=calculateMicroWins(arenaState,skillId);
  const access=getCompetitionAccess(arenaState,skillId,{
    classVerified:true,
    schoolVerified:true,
    introPassed:true,
    safetyPassed:true,
    globalSafetyPassed:true,
    moderationPassed:true,
    isMinor:true,
    guardianConsent:false,
    networkConnected:false,
    cohortSizes:{class:0,school:0,zappy:0},
  });
  const selectedAccess=access[scope];
  const scopeMeta={
    class:{number:"01",icon:"🧑‍🤝‍🧑",name:"CLASSMATES",subtitle:"Same class · same weekly prompt",accent:"green"},
    school:{number:"02",icon:"🏫",name:"SCHOOL",subtitle:"Age + skill band qualifiers",accent:"blue"},
    zappy:{number:"03",icon:"⚡",name:"ZAPPY",subtitle:"Verified network · safe aliases",accent:"purple"},
  }[scope];
  const scopeAttempts=attempts.filter(attempt=>attempt.scope===scope&&attempt.rankingStatus==="ranked");
  const currentWeek=arenaWeekKey();
  const currentScopeAttempts=scopeAttempts.filter(attempt=>attempt.weekKey===currentWeek&&attempt.challengeId===`${currentWeek}-${skillId}-${scope}`);
  const scopeBest=scopeAttempts.reduce<number|null>((best,attempt)=>attempt.overallScore===null?best:best===null?attempt.overallScore:Math.max(best,attempt.overallScore),null);
  const ladderCopy=(item:CompetitionScope)=>{
    const itemAccess=access[item];
    if(item==="class")return `${Math.min(itemAccess.qualifyingBaselineTakes,itemAccess.requiredBaselineTakes)}/${itemAccess.requiredBaselineTakes} measured baselines`;
    return `${Math.min(itemAccess.qualifyingRounds,itemAccess.requiredRounds)}/${itemAccess.requiredRounds} prior rounds · ${Math.min(itemAccess.masteryRounds,itemAccess.requiredMasteryRounds)}/${itemAccess.requiredMasteryRounds} mastery rounds`;
  };
  const openSelectedScope=()=>{
    if(scope==="class"&&!selectedAccess.unlocked){onOpen(skillId,"training");return}
    if(selectedAccess.unlocked)onOpen(skillId,scope);
  };
  const entryLabel=scope==="class"&&!selectedAccess.unlocked
    ? `BUILD BASELINE ${Math.min(selectedAccess.qualifyingBaselineTakes,3)}/3 →`
    : selectedAccess.unlocked
    ? `ENTER ${scopeMeta.name} ROUND →`
    : scope==="zappy"&&selectedAccess.ready
    ? "VERIFIED NETWORK REQUIRED"
    : `COMPLETE ${scope==="school"?"CLASS":"SCHOOL"} QUALIFIERS`;

  return <div className="arena-system">
    <section className="arena-command">
      <div><span className="pill">ZAPPY 100X SKILL SYSTEM</span><h2>Train the skill. Prove the growth. Climb together.</h2><p>Learn one move, drill the weakest measured signal, record up to three takes, and finish. Competition grows from classmates to school to the verified Zappy network.</p><div className="arena-command-actions"><button onClick={()=>onOpen(skillId,"training")}>START 10-MINUTE COACHING</button><small>Finite session · private video · no popularity score</small></div></div>
      <div className="arena-growth-orbit"><span>{education.icon}</span><b>{microWins}<small>/100</small></b><p>evidence-backed<br/>micro-wins</p></div>
    </section>

    <section className="arena-ladder" aria-label="Skills competition progression">
      <header><div><small>COMPETITION PATH</small><h3>Earn readiness in the right order</h3></div><p>Progress never depends on followers, likes, or finishing top three.</p></header>
      <div>{(["class","school","zappy"] as CompetitionScope[]).map((item,index)=>{
        const itemAccess=access[item];
        const meta={class:["🧑‍🤝‍🧑","CLASSMATES"],school:["🏫","SCHOOL"],zappy:["⚡","ZAPPY"]}[item];
        return <button className={`${scope===item?"selected":""} ${itemAccess.unlocked?"unlocked":"locked"}`} onClick={()=>setScope(item)} aria-pressed={scope===item} key={item}><i>{index+1}</i><span>{meta[0]}</span><p><b>{meta[1]}</b><small>{ladderCopy(item)}</small></p><em>{itemAccess.unlocked?"READY":item==="zappy"&&itemAccess.ready?"NETWORK LOCK":"LOCKED"}</em></button>
      })}</div>
    </section>

    <div className="arena-coach-layout">
      <aside className="arena-skill-picker"><small>CHOOSE YOUR ARENA</small>{(Object.keys(ARENA_EDUCATION) as ArenaSkill[]).map(item=>{
        const data=ARENA_EDUCATION[item];
        const itemScores=arenaState.attempts.filter(attempt=>attempt.skill===item&&attempt.overallScore!==null).map(attempt=>attempt.overallScore as number);
        const best=itemScores.length?Math.max(...itemScores):null;
        return <button className={skillId===item?"active":""} onClick={()=>onSelectSkill(item)} key={item}><span>{data.icon}</span><p><b>{data.name}</b><small>{best===null?"Start baseline":`Personal best ${best}`}</small></p><i>{skillId===item?"→":best===null?"○":"✓"}</i></button>
      })}<div className="arena-100x-note"><b>What “100X” means</b><p>100 visible micro-wins—not an unsupported promise that a person becomes literally 100 times better.</p></div></aside>

      <main className="arena-coach">
        <header><div><span>{education.icon}</span><p><small>YOUR {education.name.toUpperCase()} COACH</small><h2>{education.promise}</h2></p></div><div><b>{bestScore??"—"}</b><small>personal best</small></div></header>
        <section className="arena-micro-lesson"><div><small>1 · LEARN THE MOVE</small><h3>{latest?"Strengthen the weakest link":"Build the foundation first"}</h3><p>{education.lesson}</p><em>QUICK CHECK · {education.check}</em></div><div className="arena-stage-map">{education.stages.map((stage,index)=><span className={bestScore!==null&&bestScore>=55+index*10?"done":index===0?"current":""} key={stage}><i>{index+1}</i>{stage}</span>)}</div></section>
        <section className="arena-focus-drill"><div><small>2 · TODAY’S FOCUSED DRILL</small><h3>{coach.title}</h3><p>{coach.reason}</p><b>Target: {coach.target}</b></div><ol>{coach.steps.map(step=><li key={step}>{step}</li>)}</ol></section>
        <section className="arena-retry-card"><div><small>3 · MIRROR, COMPARE, RETRY</small><h3>{latest?`Improve ${coach.signal||"the baseline"} by 3 points`:"Record three measured baseline takes"}</h3><p>Zappy measures script overlap, pace, timing, and voice energy when available. Missing signals stay unavailable—not zero.</p></div><button onClick={()=>onOpen(skillId,"training")}>{latest?"PRACTISE + RETRY →":"START BASELINE →"}</button></section>
        <div className="arena-personal-trend"><div><small>PERSONAL GROWTH · LAST 6 VALID TAKES</small><p><b>{rankableAttempts.length}</b> measured takes <span>{improvement===null?"Baseline not ready":`${improvement>=0?"+":""}${improvement} from first take`}</span></p></div><div>{rankableAttempts.slice(-6).map(attempt=><i title={`${attempt.overallScore}/100`} style={{height:`${Math.max(8,attempt.overallScore||0)}%`}} key={attempt.id}/>)}</div></div>
      </main>
    </div>

    <section className={`arena-competition-board ${scopeMeta.accent}`}>
      <header><div><span>{scopeMeta.icon}</span><p><small>{scopeMeta.number} · {scopeMeta.name} COMPETITION</small><h2>{scopeMeta.subtitle}</h2></p></div><em>LOCAL PRACTICE PREVIEW · NOT LIVE USERS</em></header>
      <div className="arena-board-body">
        <div className="arena-self-score"><small>YOUR QUALIFYING RECORD</small><div><span><b>{scopeBest??"—"}</b><small>best submitted</small></span><span><b>{currentScopeAttempts.length}/{ARENA_RULES.maxTakesPerRound}</b><small>takes this challenge</small></span><span><b>{selectedAccess.cohortSize}</b><small>verified peers connected</small></span></div><p>{selectedAccess.cohortSize<selectedAccess.minimumCohortSize?`Ordinal ranks stay hidden below ${selectedAccess.minimumCohortSize} verified participants. Personal growth still counts.`:"The cohort is large enough to display privacy-safe ranks."}</p></div>
        <div className="arena-unlock-card"><small>{selectedAccess.unlocked?"ROUND READY":"HOW TO UNLOCK"}</small><h3>{selectedAccess.unlocked?`Enter the ${scopeMeta.name.toLowerCase()} common challenge`:entryLabel.toLowerCase()}</h3><ul>{scope==="class"?<><li>Complete the short teaching mission</li><li>Save three valid measured baselines</li><li>Use the same weekly prompt and rubric</li></>:scope==="school"?<><li>Finish 3 Classmates rounds</li><li>Reach 60+ mastery in 2 rounds</li><li>Complete the school safety lesson</li></>:<><li>Finish 3 School rounds</li><li>Reach 70+ mastery in 2 rounds</li><li>Guardian consent + moderation + verified network</li></>}</ul><button disabled={scope!=="class"&&!selectedAccess.unlocked} onClick={openSelectedScope}>{entryLabel}</button></div>
      </div>
      <footer><p><b>Fair score</b><span>65% demonstrated mastery · 25% improvement from frozen baseline · 10% balanced signals</span></p><p><b>Honest boundary</b><span>Live Zappy ranking requires verified network data. No classmates, schoolmates, or global ranks are fabricated locally.</span></p></footer>
    </section>

    <section className="arena-safety-strip"><span>🛡️</span><p><b>Skill—not popularity</b><small>No public child videos, followers, comments, direct messages, attractiveness scoring, forced eye-contact score, or accent ranking. Raw recordings stay on this device.</small></p><span>⏱️</span><p><b>Finite by design</b><small>Maximum 3 scored takes, 10 minutes, then a clear “done for today.” Six-round seasons count the best four.</small></p></section>
  </div>;
}

type MirrorSkill={id:ArenaSkill;icon:string;name:string;level:string;prompt:string;reference:string;target:number;cues:string[]};
type SpeechResultEvent={results:ArrayLike<{[index:number]:{transcript:string}}>} ;
type SpeechRecognizer={continuous:boolean;interimResults:boolean;lang:string;onresult:((event:SpeechResultEvent)=>void)|null;start:()=>void;stop:()=>void};
type SpeechRecognizerConstructor=new()=>SpeechRecognizer;
const MIRROR_SKILLS:MirrorSkill[]=[
  {id:"public",icon:"🎙️",name:"Public Speaking",level:"Level 4",prompt:"Explain why gravity matters in everyday life.",reference:"Have you ever wondered why everything comes back down? Gravity is the invisible pull that keeps our feet on Earth, brings a thrown ball back to us, and keeps the Moon moving around our planet. Without gravity, everyday life—and our whole solar system—would be completely different.",target:30,cues:["Open with a question","One idea per sentence","Look into the lens","Finish with a strong final line"]},
  {id:"vlog",icon:"🎬",name:"Vlogging",level:"Level 3",prompt:"Create an energetic 30-second science vlog about gravity.",reference:"Hey, Zappy explorers! Today’s invisible superhero is gravity. Drop a pencil—gravity wins. Jump in the air—gravity brings you home. Even the Moon stays with Earth because of it. Try the drop test yourself, tell me what you notice, and follow for the next tiny science adventure!",target:30,cues:["Friendly camera greeting","Show one quick example","Vary facial expression","End with a call to action"]},
  {id:"leadership",icon:"👑",name:"Leadership",level:"Level 2",prompt:"Guide your team through a bridge-building challenge.",reference:"Team, our goal is a bridge that holds the truck for ten seconds. First, Aanya will test the materials. Kabir will build the centre support. I will track time and listen to both ideas. If the first design fails, we will study where it bends, change one thing, and try again together.",target:35,cues:["State the shared goal","Give clear roles","Use inclusive language","Explain the next step"]},
  {id:"social",icon:"🤝",name:"Social Skills",level:"Level 6",prompt:"Disagree politely when a teammate suggests a weak design.",reference:"I see why you chose one long beam—it is quick to build. I’m worried the middle may bend under the truck. Could we test your version first, then add one centre support and compare both results? That way we use your idea and check the evidence together.",target:25,cues:["Acknowledge their idea","Use a calm I-statement","Suggest a fair test","Invite agreement"]},
  {id:"mindfulness",icon:"🧘",name:"Mindful Communication",level:"Level 1",prompt:"Guide a voluntary one-minute focus reset before class.",reference:"If you would like to join, place both feet comfortably and notice one sound in the room. Take one easy breath at your own pace. Let your shoulders rest, look around when you are ready, and choose one thing you want to focus on next. You can stop at any time.",target:45,cues:["Make participation optional","Use one short cue at a time","Keep every word audible","End with a clear return to the room"]},
];

function SkillMirrorStudio({initialSkillId,entryScope,onComplete,onClose}:{initialSkillId:ArenaSkill;entryScope:ArenaEntryScope;onComplete:(result:ArenaMirrorResult)=>string;onClose:()=>void}){
  const [skillId,setSkillId]=useState<ArenaSkill>(initialSkillId);
  const [phase,setPhase]=useState<"setup"|"ready"|"recording"|"review">("setup");
  const [cameraError,setCameraError]=useState("");
  const [seconds,setSeconds]=useState(0);
  const [recordingUrl,setRecordingUrl]=useState("");
  const [transcript,setTranscript]=useState("");
  const [teleprompter,setTeleprompter]=useState(true);
  const [visualChecks,setVisualChecks]=useState<string[]>([]);
  const [energy,setEnergy]=useState(0);
  const [submissionStatus,setSubmissionStatus]=useState("");
  const liveVideo=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const takeLimitRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const attemptKeyRef=useRef("");
  const recognitionRef=useRef<{stop:()=>void}|null>(null);
  const audioContextRef=useRef<AudioContext|null>(null);
  const animationRef=useRef<number|null>(null);
  const energySamples=useRef<number[]>([]);
  const skill=MIRROR_SKILLS.find(item=>item.id===skillId)||MIRROR_SKILLS[0];

  useEffect(()=>()=>{stopTracks();if(recordingUrl)URL.revokeObjectURL(recordingUrl)},[recordingUrl]);
  useEffect(()=>{if((phase==="ready"||phase==="recording")&&liveVideo.current&&streamRef.current){liveVideo.current.srcObject=streamRef.current;liveVideo.current.play().catch(()=>{})}},[phase]);
  function stopTracks(){
    if(timerRef.current)clearInterval(timerRef.current);
    if(takeLimitRef.current)clearTimeout(takeLimitRef.current);
    if(animationRef.current)cancelAnimationFrame(animationRef.current);
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach(track=>track.stop());
    audioContextRef.current?.close().catch(()=>{});
    streamRef.current=null;
  }
  async function enableCamera(){
    setCameraError("");
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera recording is not supported in this browser.");
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:{echoCancellation:true,noiseSuppression:true}});
      streamRef.current=stream;
      if(liveVideo.current){liveVideo.current.srcObject=stream;await liveVideo.current.play().catch(()=>{})}
      setPhase("ready");
      return stream;
    }catch(error){
      setCameraError(error instanceof Error?error.message:"Camera or microphone permission was not granted.");
      return null;
    }
  }
  function beginEnergy(stream:MediaStream){
    try{
      const context=new AudioContext();
      const analyser=context.createAnalyser();analyser.fftSize=256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data=new Uint8Array(analyser.frequencyBinCount);
      audioContextRef.current=context;energySamples.current=[];
      const sample=()=>{analyser.getByteFrequencyData(data);const avg=data.reduce((a,b)=>a+b,0)/data.length;energySamples.current.push(avg);animationRef.current=requestAnimationFrame(sample)};
      sample();
    }catch{}
  }
  function beginTranscript(){
    const speechWindow=window as unknown as {SpeechRecognition?:SpeechRecognizerConstructor;webkitSpeechRecognition?:SpeechRecognizerConstructor};
    const Recognition=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!Recognition)return;
    try{
      const recognition=new Recognition();
      recognition.continuous=true;recognition.interimResults=true;recognition.lang="en-IN";
      recognition.onresult=(event:SpeechResultEvent)=>{let text="";for(let i=0;i<event.results.length;i++)text+=event.results[i][0].transcript+" ";setTranscript(text.trim())};
      recognition.start();recognitionRef.current=recognition;
    }catch{}
  }
  async function startRecording(){
    const stream=streamRef.current||await enableCamera();if(!stream)return;
    if(!window.MediaRecorder){setCameraError("Video recording is not supported in this browser.");return}
    chunksRef.current=[];setTranscript("");setSeconds(0);setEnergy(0);setVisualChecks([]);setSubmissionStatus("");
    attemptKeyRef.current=`${Date.now()}-${skillId}`;
    const recorder=new MediaRecorder(stream);
    recorder.ondataavailable=event=>{if(event.data.size)chunksRef.current.push(event.data)};
    recorder.onstop=()=>{
      const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"video/webm"});
      if(recordingUrl)URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(URL.createObjectURL(blob));
      const samples=energySamples.current;setEnergy(samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0);
      setPhase("review");
    };
    recorderRef.current=recorder;recorder.start(250);beginEnergy(stream);beginTranscript();setPhase("recording");
    timerRef.current=setInterval(()=>setSeconds(value=>value+1),1000);
    takeLimitRef.current=setTimeout(stopRecording,Math.min(120,skill.target+15)*1000);
  }
  function stopRecording(){
    if(timerRef.current)clearInterval(timerRef.current);
    if(takeLimitRef.current)clearTimeout(takeLimitRef.current);
    if(animationRef.current)cancelAnimationFrame(animationRef.current);
    recognitionRef.current?.stop();audioContextRef.current?.close().catch(()=>{});
    if(recorderRef.current?.state==="recording")recorderRef.current.stop();
  }
  function resetTake(){if(recordingUrl)URL.revokeObjectURL(recordingUrl);setRecordingUrl("");setTranscript("");setSeconds(0);setVisualChecks([]);setSubmissionStatus("");setPhase("ready");setTimeout(()=>{if(liveVideo.current&&streamRef.current){liveVideo.current.srcObject=streamRef.current;liveVideo.current.play().catch(()=>{})}},0)}
  const scores=useMemo(()=>{
    const clean=(value:string)=>value.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(/\s+/).filter(word=>word.length>2);
    const spoken=clean(transcript),reference=clean(skill.reference);
    const uniqueReference=[...new Set(reference)];
    const match=spoken.length?Math.min(100,Math.round(uniqueReference.filter(word=>spoken.includes(word)).length/uniqueReference.length*100)):null;
    const wpm=seconds&&spoken.length?Math.round(spoken.length/(seconds/60)):null;
    const pace=wpm===null?null:Math.max(35,Math.min(100,Math.round(100-Math.abs(wpm-125)*.65)));
    const timing=Math.max(35,Math.min(100,Math.round(100-Math.abs(seconds-skill.target)*3)));
    const voice=energy?Math.max(40,Math.min(100,Math.round(50+energy*1.35))):null;
    const measured=[match,pace,timing,voice].filter((x):x is number=>x!==null);
    const overall=measured.length?Math.round(measured.reduce((a,b)=>a+b,0)/measured.length):null;
    return {match,wpm,pace,timing,voice,overall};
  },[transcript,seconds,skill,energy]);
  const measuredSignals:MeasuredSignals={script:scores.match,pace:scores.pace,timing:scores.timing,voice:scores.voice};
  const measuredSignalCount=countMeasuredSignals(measuredSignals);
  const nextCoach=getWeakestSignalCoaching(skillId,measuredSignals);
  const entryLabel=entryScope==="training"?"PRIVATE TRAINING":`${entryScope.toUpperCase()} QUALIFIER`;
  function saveResult(){
    if(submissionStatus)return;
    const reason=onComplete({skill:skillId,overallScore:scores.overall,signals:measuredSignals,attemptKey:attemptKeyRef.current||`${Date.now()}-${skillId}`});
    const messages:Record<string,string>={
      ranked:`Measured ${entryScope} submission saved.`,
      practice:"Private training result saved. Complete three measured baselines to unlock Classmates.",
      "insufficient-evidence":"Saved as private practice because fewer than three measured signals were available.",
      "limit-reached":"Three scored takes are already saved for this weekly round. This take stays private practice.",
      duplicate:"This take was already saved.",
      "self-review":"Visual self-review saved privately and excluded from ranking.",
      "invalid-attempt":"This result could not be saved safely.",
    };
    setSubmissionStatus(messages[reason]||"Result saved.");
  }
  const toggleCheck=(item:string)=>setVisualChecks(items=>items.includes(item)?items.filter(x=>x!==item):[...items,item]);

  return <div className="modal-backdrop mirror-backdrop" role="dialog" aria-modal="true" aria-label="AI Mirror Skills Arena">
    <div className="mirror-studio">
      <header><div><span>🪞</span><div><small>ZAPPY SKILLS ARENA · {entryLabel}</small><h2>AI Mirror Studio</h2><p>Learn · record · compare · improve · done</p></div></div><div className="mirror-privacy">🔒 Video stays on this device in this local prototype</div><button onClick={onClose}>×</button></header>
      <div className="mirror-body">
        <aside className="mirror-skill-nav"><small>CHOOSE A SKILL</small>{MIRROR_SKILLS.map(item=><button disabled={entryScope!=="training"&&skillId!==item.id} className={skillId===item.id?"active":""} onClick={()=>{stopTracks();if(recordingUrl)URL.revokeObjectURL(recordingUrl);setSkillId(item.id);setPhase("setup");setTranscript("");setRecordingUrl("");setSubmissionStatus("")}} key={item.id}><span>{item.icon}</span><div><b>{item.name}</b><small>{item.level}</small></div><i>›</i></button>)}<div className="mirror-safety"><b>Practice safely</b><p>No personal information, public videos, comments, followers, or appearance scoring. Broader competition needs parent consent.</p></div></aside>
        <main className="mirror-main">
          <div className="mirror-challenge"><span>{skill.icon}</span><div><small>{entryLabel} · TODAY’S {skill.name.toUpperCase()} CHALLENGE · {skill.target} SEC</small><h3>{skill.prompt}</h3></div><label><input type="checkbox" checked={teleprompter} onChange={e=>setTeleprompter(e.target.checked)}/> Teleprompter</label></div>
          {phase==="setup"&&<div className="mirror-setup-grid"><section className="reference-card"><div className="reference-stage"><span>🤖</span><i/><i/><i/></div><small>AI REFERENCE PERFORMANCE</small><h3>Model the structure—not the personality</h3><p>“{skill.reference}”</p><div className="cue-list">{skill.cues.map((cue,i)=><span key={cue}><b>{i+1}</b>{cue}</span>)}</div></section><section className="camera-permission"><span>📹</span><h3>Ready to see your mirror?</h3><p>Allow camera and microphone access. You’ll see yourself live, record one take, then compare it beside the reference.</p><div><b>Measured from your take</b><p>✓ duration and pace<br/>✓ spoken-word match<br/>✓ voice-energy signal<br/>✓ your visual review</p></div>{cameraError&&<em>{cameraError}</em>}<button onClick={enableCamera}>ENABLE CAMERA & MIC</button><small>You control recording. Nothing is uploaded.</small></section></div>}
          {(phase==="ready"||phase==="recording")&&<div className="mirror-record-stage"><div className="live-camera"><video ref={liveVideo} muted playsInline/><span className="camera-label">{phase==="recording"?"● RECORDING":"● LIVE MIRROR"}</span>{teleprompter&&<div className="teleprompter"><small>YOUR GUIDE</small><p>{skill.reference}</p></div>}<div className="framing-guide"><i/><span>Eyes near this line</span></div></div><aside><small>BEFORE YOU START</small><h3>{skill.name} mirror cues</h3>{skill.cues.map(cue=><p key={cue}>✓ {cue}</p>)}<div className="record-clock"><b>{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</b><small>target {skill.target}s</small></div>{phase==="recording"?<button className="stop-record" onClick={stopRecording}>■ STOP & COMPARE</button>:<button className="start-record" onClick={startRecording}>● START RECORDING</button>}</aside></div>}
          {phase==="review"&&<div className="mirror-review"><div className="compare-stage"><section><small>MODEL GUIDE</small><div className="model-replay"><span>🤖</span><div className="model-wave">{[1,2,3,4,5,6,7,8,9].map(i=><i style={{height:`${18+(i%4)*12}px`}} key={i}/>)}</div></div><p>“{skill.reference}”</p></section><section><small>YOUR TAKE · {seconds}s</small>{recordingUrl?<video src={recordingUrl} controls playsInline/>:<div className="no-take">No recording available</div>}<p>{transcript?`Transcript: “${transcript}”`:"Automatic transcript was unavailable. Timing and audio energy are still measured."}</p></section></div><div className="mirror-results"><section><div className="overall-ring" style={{"--score":`${scores.overall||0}%`} as CSSProperties}><b>{scores.overall??"—"}</b><small>measured score</small></div><div><small>REAL TAKE COMPARISON</small><h3>{scores.overall===null?"Play back and review your take":scores.overall>=85?"Strong, camera-ready take!":scores.overall>=65?"Good foundation—one focused retry will help.":"Nice first take—slow down and use the guide."}</h3><p>{measuredSignalCount}/4 signals measured. Missing signals stay unavailable—not zero.</p></div></section><div className="signal-scores">{[["Script match",scores.match,transcript?"Reference-word overlap":"Transcript unavailable"],["Pace",scores.pace,scores.wpm?`${scores.wpm} words/min · target ≈125`:"Transcript unavailable"],["Timing",scores.timing,`${seconds}s · target ${skill.target}s`],["Voice energy",scores.voice,energy?"Microphone energy signal":"Audio signal unavailable"]].map(row=><div key={row[0] as string}><span><b>{row[0]}</b><em>{row[1]===null?"—":`${row[1]}/100`}</em></span><i><u style={{width:`${row[1]||0}%`}}/></i><small>{row[2]}</small></div>)}</div></div><div className="mirror-next-coach"><span>🎯</span><div><small>ONE FOCUSED RETRY</small><h3>{nextCoach.title}</h3><p>{nextCoach.target}</p></div><em>{entryScope!=="training"&&measuredSignalCount<3?"PRACTICE ONLY · NOT RANKABLE":`FOCUS · ${nextCoach.signal||"BASELINE"}`}</em></div><div className="visual-self-review"><div><small>WATCH YOUR VIDEO, THEN CHECK HONESTLY</small><h3>Private visual self-review</h3><p>These checks help reflection but never enter a competition score. Zappy does not score appearance, forced eye contact, emotion, accent, or disability-related movement.</p></div>{["Eyes returned to the lens","Face was clearly visible","Posture looked open","Gestures supported the message"].map(item=><button className={visualChecks.includes(item)?"checked":""} onClick={()=>toggleCheck(item)} key={item}><span>{visualChecks.includes(item)?"✓":"○"}</span>{item}</button>)}</div>{submissionStatus&&<div className="mirror-save-status" role="status">✓ {submissionStatus}</div>}<div className="mirror-actions"><button onClick={resetTake}>↻ RETRY WITH COACH</button><button className="primary" disabled={Boolean(submissionStatus)} onClick={saveResult}>{submissionStatus?"RESULT SAVED ✓":entryScope==="training"?"SAVE PRIVATE TRAINING":"SUBMIT MEASURED ROUND"}</button></div></div>}
        </main>
      </div>
    </div>
  </div>
}

type ShopItem={id:string;name:string;category:string;price:number;icon:string;tag:string;desc:string;colors:string[];tone:string;personalise?:boolean};
const SHOP_ITEMS:ShopItem[]=[
  {id:"aurora-bag",name:"Aurora Flex Designer Backpack",category:"Designer Bags",price:4200,icon:"🎒",tag:"BESTSELLER",desc:"Water-resistant statement backpack with laptop sleeve, secret coin pocket and reflective lightning trim.",colors:["#7c3aed","#1cb0f6","#ff67a7"],tone:"violet",personalise:true},
  {id:"galaxy-roll",name:"Galaxy Rolltop School Bag",category:"Designer Bags",price:4800,icon:"🎒",tag:"LIMITED DROP",desc:"Expandable rolltop bag with galaxy lining, padded straps and magnetic buckle.",colors:["#121b42","#6338b8","#20c4cb"],tone:"navy",personalise:true},
  {id:"mini-sling",name:"Bolt Mini Crossbody",category:"Designer Bags",price:2200,icon:"👜",tag:"NEW",desc:"Compact weekend sling for pocket notebook, phone and favourite pen.",colors:["#58cc02","#ff9600","#1cb0f6"],tone:"green",personalise:true},
  {id:"prism-case",name:"Prism Pop Pencil Vault",category:"Pencil Cases",price:1100,icon:"👝",tag:"TRENDING",desc:"Hard-shell two-layer pencil case with mesh organiser and holographic zip.",colors:["#ce82ff","#ff67a7","#20c4cb"],tone:"pink",personalise:true},
  {id:"namespark",name:"NameSpark Hardbound Journal",category:"Notebooks",price:1600,icon:"📓",tag:"PERSONALISED",desc:"Premium dotted journal with foil Zappy ID, elastic closure and 160 thick pages.",colors:["#202b55","#8e44cc","#d14f83"],tone:"indigo",personalise:true},
  {id:"holo-books",name:"Holographic Subject Notebook Set",category:"Notebooks",price:2100,icon:"📚",tag:"SET OF 5",desc:"Five colour-coded notebooks with erasable subject labels and progress trackers.",colors:["#1cb0f6","#ce82ff","#58cc02"],tone:"blue",personalise:true},
  {id:"quest-plan",name:"Daily Quest Study Planner",category:"Notebooks",price:1400,icon:"🗓️",tag:"FOCUS PICK",desc:"Undated 90-day planner with mission blocks, habit streaks and weekly reward pages.",colors:["#ff9600","#58cc02","#1cb0f6"],tone:"orange",personalise:true},
  {id:"sketch-forge",name:"Story Forge Sketchbook",category:"Notebooks",price:1300,icon:"🎨",tag:"CREATOR",desc:"Mixed-media sketchbook with story prompts, storyboard grids and thick art paper.",colors:["#ff67a7","#7c3aed","#1cb0f6"],tone:"rose",personalise:true},
  {id:"gel-pack",name:"GlidePro Gel Pen Collection",category:"Pens & Pencils",price:850,icon:"🖊️",tag:"12 COLOURS",desc:"Smooth quick-dry gel pens with soft triangular grip and vivid study colours.",colors:["#1cb0f6","#ff67a7","#58cc02"],tone:"cyan"},
  {id:"fine-line",name:"Spectrum Fineliner Studio",category:"Pens & Pencils",price:1250,icon:"🖍️",tag:"24 COLOURS",desc:"Fine-tip colour pens for notes, diagrams, lettering and tiny illustrations.",colors:["#ff9600","#ce82ff","#20c4cb"],tone:"rainbow"},
  {id:"fountain",name:"InkShift Junior Fountain Pen",category:"Pens & Pencils",price:1900,icon:"✒️",tag:"PREMIUM",desc:"Beginner-friendly fountain pen with smooth nib, two grips and six ink cartridges.",colors:["#182238","#7c3aed","#1f9aaa"],tone:"black",personalise:true},
  {id:"neon-pencil",name:"Neon Mechanical Pencil Trio",category:"Pens & Pencils",price:950,icon:"✏️",tag:"0.5 + 0.7 MM",desc:"Three balanced mechanical pencils with spare lead vault and twist erasers.",colors:["#d7ff2f","#ff67a7","#1cb0f6"],tone:"lime"},
  {id:"pencil-duo",name:"Lightning Pencil Duo",category:"Pens & Pencils",price:240,icon:"✏️",tag:"EASY REWARD",desc:"Two premium graphite pencils with lightning toppers and name labels.",colors:["#58cc02","#1cb0f6","#ce82ff"],tone:"green",personalise:true},
  {id:"geometry",name:"Scholar Geometry Vault",category:"Desk Gear",price:1700,icon:"📐",tag:"9-PIECE KIT",desc:"Metal compass, divider, rulers and protractor inside a magnetic hard case.",colors:["#182238","#1cb0f6","#ff9600"],tone:"steel",personalise:true},
  {id:"organiser",name:"Desk Glow Modular Organiser",category:"Desk Gear",price:2400,icon:"🗄️",tag:"MODULAR",desc:"Stackable desk pods for pens, notes and cables with a soft reading-light strip.",colors:["#f4f4f1","#ce82ff","#20c4cb"],tone:"white"},
  {id:"art-kit",name:"Creative Lab Colour Kit",category:"Bundles",price:2900,icon:"🧰",tag:"42 PIECES",desc:"Colour pencils, brush pens, crayons, ruler, sharpener and portable art wallet.",colors:["#ff9600","#ff67a7","#7c3aed"],tone:"sunset"},
  {id:"school-drop",name:"Ultimate School Drop Bundle",category:"Bundles",price:6500,icon:"🎁",tag:"MEGA BUNDLE",desc:"Designer backpack, personalised journal, pencil vault, gel pens and bottle tag.",colors:["#7c3aed","#1cb0f6","#58cc02"],tone:"purple",personalise:true},
  {id:"stickers",name:"Zappy Holographic Sticker Pack",category:"Desk Gear",price:180,icon:"⚡",tag:"20 STICKERS",desc:"Weather-resistant mascot, subject, streak and achievement stickers.",colors:["#ffd84d","#58cc02","#ce82ff"],tone:"yellow"},
];

function StationeryBoutique({coins,onSpend,onClose}:{coins:number;onSpend:(amount:number)=>void;onClose:()=>void}){
  const [category,setCategory]=useState("All");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<ShopItem|null>(null);
  const [wishlist,setWishlist]=useState<string[]>([]);
  const [colour,setColour]=useState("");
  const [name,setName]=useState("@arjun_zappy");
  const [parentOk,setParentOk]=useState(false);
  const [order,setOrder]=useState<ShopItem|null>(null);
  const categories=["All",...new Set(SHOP_ITEMS.map(item=>item.category))];
  const filtered=SHOP_ITEMS.filter(item=>(category==="All"||item.category===category)&&(`${item.name} ${item.desc}`.toLowerCase().includes(query.toLowerCase())));
  function openItem(item:ShopItem){setSelected(item);setColour(item.colors[0]);setParentOk(false)}
  function redeem(){
    if(!selected||coins<selected.price||!parentOk)return;
    onSpend(selected.price);setOrder(selected);setSelected(null);
  }
  function toggleWish(id:string){setWishlist(items=>items.includes(id)?items.filter(item=>item!==id):[...items,id])}
  if(order)return <div className="modal-backdrop boutique-backdrop" role="dialog" aria-modal="true"><div className="boutique-success"><div className="shop-confetti">{Array.from({length:20},(_,i)=><i key={i} style={{left:`${i*5}%`,animationDelay:`${(i%5)*.1}s`}}/>)}</div><span>{order.icon}</span><small>REDEMPTION CONFIRMED</small><h1>Your {order.name} is reserved!</h1><p>🪙 {order.price.toLocaleString("en-IN")} coins redeemed · parent approval recorded</p><div><b>Personalisation</b><p>{order.personalise?name:"Standard edition"} · <i style={{background:colour}}/> selected colour</p><b>Delivery</b><p>Linked family delivery profile · confirmation shown to Priya</p></div><button onClick={()=>setOrder(null)}>CONTINUE SHOPPING</button><button className="shop-close-order" onClick={onClose}>DONE</button></div></div>;
  return <div className="modal-backdrop boutique-backdrop" role="dialog" aria-modal="true" aria-label="Zappy Stationery Boutique">
    <div className="boutique">
      <header><div className="boutique-logo"><span>⚡</span><div><small>ZAPPY REWARDS</small><h2>Stationery Boutique</h2><p>Fancy gear earned through learning</p></div></div><div className="boutique-balance"><span>🪙</span><div><small>YOUR COINS</small><b>{coins.toLocaleString("en-IN")}</b></div></div><button onClick={onClose}>×</button></header>
      <div className="boutique-tools"><div className="category-scroll">{categories.map(item=><button className={category===item?"active":""} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search bags, pens, notebooks…"/></label><button className="wish-count" onClick={()=>setCategory("All")}>♥ {wishlist.length}</button></div>
      <main>
        <section className="boutique-hero"><div><span>LIMITED SCHOOL DROP</span><h1>Carry your streak.<br/>Wear your Zappy ID.</h1><p>Premium designer gear personalised for learners who keep showing up.</p><button onClick={()=>openItem(SHOP_ITEMS[0])}>EXPLORE AURORA BAG →</button></div><div className="hero-bag"><i>⚡</i><span>🎒</span><b>@arjun_zappy</b></div><div className="hero-float f1">✏️</div><div className="hero-float f2">📓</div><div className="hero-float f3">🖊️</div></section>
        <div className="shop-heading"><div><small>{category.toUpperCase()}</small><h2>{category==="All"?"Fresh rewards for your next learning streak":category}</h2></div><span>{filtered.length} items · physical rewards need parent approval</span></div>
        <section className="boutique-grid">{filtered.map(item=><article key={item.id}><div className={`product-visual ${item.tone}`}><em>{item.tag}</em><button className={wishlist.includes(item.id)?"liked":""} onClick={()=>toggleWish(item.id)} aria-label="Toggle wishlist">♥</button><span>{item.icon}</span><i/><i/><small>{item.personalise?"YOUR NAME":item.category.toUpperCase()}</small></div><div className="product-copy"><small>{item.category}</small><h3>{item.name}</h3><p>{item.desc}</p><div className="colour-dots">{item.colors.map(color=><i style={{background:color}} key={color}/>)}</div><footer><b>🪙 {item.price.toLocaleString("en-IN")}</b><button onClick={()=>openItem(item)}>{coins>=item.price?"VIEW & REDEEM":`NEED ${(item.price-coins).toLocaleString("en-IN")}`}</button></footer></div></article>)}</section>
      </main>
      {selected&&<div className="product-sheet-backdrop" onClick={()=>setSelected(null)}><section className="product-sheet" onClick={event=>event.stopPropagation()}><button className="sheet-close" onClick={()=>setSelected(null)}>×</button><div className={`sheet-product ${selected.tone}`}><em>{selected.tag}</em><span>{selected.icon}</span><b>{selected.personalise?name:"ZAPPY ORIGINAL"}</b></div><div className="sheet-copy"><small>{selected.category}</small><h2>{selected.name}</h2><p>{selected.desc}</p><div className="sheet-price"><b>🪙 {selected.price.toLocaleString("en-IN")}</b><span>{coins>=selected.price?`${(coins-selected.price).toLocaleString("en-IN")} coins left after redemption`:`Earn ${(selected.price-coins).toLocaleString("en-IN")} more coins`}</span></div><label>Choose colour<div>{selected.colors.map(color=><button className={colour===color?"on":""} style={{background:color}} onClick={()=>setColour(color)} key={color}/>)}</div></label>{selected.personalise&&<label>Personalise it<input maxLength={22} value={name} onChange={event=>setName(event.target.value)} /></label>}<label className="parent-confirm"><input type="checkbox" checked={parentOk} onChange={event=>setParentOk(event.target.checked)}/><span><b>Parent approval</b><small>A parent is helping me redeem this physical item using the linked delivery profile.</small></span></label><button className="redeem-product" disabled={coins<selected.price||!parentOk} onClick={redeem}>{coins<selected.price?`NEED ${(selected.price-coins).toLocaleString("en-IN")} MORE COINS`:!parentOk?"ASK A PARENT TO CONFIRM":`REDEEM FOR ${selected.price.toLocaleString("en-IN")} COINS`}</button><button className="add-wish" onClick={()=>toggleWish(selected.id)}>{wishlist.includes(selected.id)?"♥ SAVED TO WISHLIST":"♡ ADD TO WISHLIST"}</button></div></section></div>}
    </div>
  </div>
}

function LeagueView({ xp }: { xp: number }) {
  const people = [["🥇","Riya","1,520"],["🥈","Vivaan","1,390"],["🥉","Aanya","1,310"],["4","You",xp.toLocaleString()],["5","Kabir","1,180"],["6","Meera","1,090"]];
  return <><p className="lead">Top 3 advance to the Sapphire League.</p><div className="league-list">{people.map((p, i) => <div className={i === 3 ? "you" : ""} key={p[1]}><span>{p[0]}</span><i>{i === 3 ? "👦" : ["👧","👦","👧","👦","👧"][i > 3 ? i - 1 : i]}</i><b>{p[1]}</b><em>⚡ {p[2]} XP</em></div>)}</div></>;
}

function ProfileView({xp,onShop}:{xp:number;onShop:()=>void}) {
  return <><div className="profile-card"><div className="big-avatar">👦</div><div><span className="pill">LEVEL 18</span><h2>Arjun Sharma</h2><p>@arjun_zappy · Class 4 · CBSE</p><div className="xp-bar"><i style={{width:"68%"}}/></div><small>{xp.toLocaleString()} XP · 260 XP to Level 19</small></div></div><button className="profile-shop-banner" onClick={onShop}><span>🎒</span><div><small>ZAPPY STATIONERY BOUTIQUE</small><h2>Turn learning coins into something you can carry.</h2><p>Designer bags · personalised notebooks · premium pens · pencil kits</p></div><b>SHOP NOW →</b></button><div className="stats-grid">{[["🔥","14","day streak"],["⚡",xp.toLocaleString(),"total XP"],["🏆","38","top 3 finishes"],["⭐","127","perfect lessons"]].map(s => <div key={s[2]}><span>{s[0]}</span><b>{s[1]}</b><small>{s[2]}</small></div>)}</div><h2 className="section-title">Recent badges</h2><div className="badge-row">{["🌉 Bridge Brain","🧪 Lab Legend","📚 Word Wizard"].map(x => <div key={x}>{x}</div>)}</div></>;
}
