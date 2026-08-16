"use client";

import { buildRoleAIPulse, type ZappyPulseContext, type ZappyPulseRole } from "./zappy-pulse";

export function RoleAIPulse({
  role,
  context,
  onPrimary,
  onSecondary,
}: {
  role: ZappyPulseRole;
  context: ZappyPulseContext | null;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const pulse = buildRoleAIPulse(role, context);
  const ready = pulse.status === "ready";
  return <section className={`zappy-role-pulse ${role} ${pulse.status}`} aria-label={role === "teacher" ? "Zappy AI teaching prep pulse" : "Zappy student coach warm-up"}>
    <header>
      <span aria-hidden="true">{role === "teacher" ? "🦉" : "⚡"}</span>
      <div><small>{pulse.eyebrow}</small><h2>{pulse.title}</h2><p>{pulse.contextLine}</p></div>
      <b>{ready ? "READY" : "SOURCE FIRST"}</b>
    </header>
    <div className="zappy-role-pulse-body">
      <article className="zappy-pulse-hook"><small>{role === "teacher" ? "WALK-IN HOOK" : "30-SECOND SPARK"}</small><h3>{pulse.hook}</h3><p>{pulse.explanation}</p></article>
      <article className="zappy-pulse-question"><span aria-hidden="true">?</span><div><small>ONE THINKING QUESTION</small><p>{pulse.question}</p></div></article>
      {pulse.misconception && <article className="zappy-pulse-misconception"><span aria-hidden="true">⚠</span><p>{pulse.misconception}</p></article>}
    </div>
    <footer>
      <small><span aria-hidden="true">🛡️</span>{pulse.sourceLabel}</small>
      <div><button className="secondary" onClick={onSecondary}>{role === "teacher" ? "OPEN EVIDENCE" : "TEACHER SIDE QUESTS"}</button><button onClick={onPrimary}>{ready ? role === "teacher" ? "OPEN FULL PREP →" : "PLAY THIS IDEA →" : "SET EXACT STAGE →"}</button></div>
    </footer>
  </section>;
}
