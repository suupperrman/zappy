# Zappy — UI/UX Design Brief

## 1. Design direction
Use an original, playful education interface inspired by friendly game-like learning products—never copy Duolingo assets, illustrations, wording or exact trade dress. Visual language: Zappy lime green, deep forest contrast, warm white cards, sky-blue supporting accent, rounded tactile surfaces, expressive but accessible motion.

## 2. Information architecture
- Shared: Daily Loop, Learn/Teach, Exam Intelligence, Skills Arena, Shop, Notifications, Profile.
- Teacher: Daily Teaching Loop, Classes, Assignments, Students, Exam Intelligence, Curriculum, Exports.
- Student: Daily Learning Loop, Learn, Games, Skills Arena, Leagues, Shop, Profile.
- Parent: Daily Family Loop, Children, Diary/Growth, School updates, Messages, Shop approvals, Profile.

## 3. Core screen requirements
### Daily loop home
One primary card fills the content priority: identity of class/child, a single recommended action, duration, progress, why it is recommended and exit/finish state. Secondary cards are “up next,” proof/history and optional AI help. Avoid crowded dashboards and more than one primary CTA.

### Teacher lesson prep
Progressive disclosure in 5 steps: Class → Topic → Plan → Teach → Questions/Assign. Left selection rail or compact drawer; right main content. Keep a visible “Today at a glance” summary. Copy/send controls are explicit; no hidden automation.

### Student learning session
Large question/action, one task per screen, progress nodes, clear feedback, encouraging language, predictable back/exit. Use reward animation only after meaningful completion and always honour `prefers-reduced-motion`.

### Parent dashboard
Calm, credible and diary-like. Use plain-language evidence (“completed 4 questions; selected ‘need help’”) instead of grading a child emotionally. Make communications reviewable before sending.

### Skills mirror
Privacy first: explain camera/mic purpose before requesting browser permission; preview, stop, delete and keep-private are always visible. Feedback is rubric cards, not a pseudo-diagnostic of emotion or appearance.

## 4. Design system
- Type: friendly rounded display type plus highly legible sans-serif body type.
- Minimum body text 16px; controls at least 44×44px; avoid text below 12px except legally necessary metadata.
- Color contrast WCAG AA. State must never rely on colour alone.
- Components: button, icon button, card, progress path, tag/source badge, lesson step, quiz choice, bottom sheet, modal, toast, empty/error state and skeleton.
- Motion: 150–250ms typical, transform/opacity only; reduced-motion version removes nonessential movement.

## 5. Responsive behaviour
Mobile is primary. Bottom navigation for student/parent; teacher can use a collapsible side rail. No essential desktop-only hover actions. Tables become filterable cards. Screen-reader headings and keyboard focus order match visual order.

## 6. Content and trust conventions
- Cite curriculum/paper source near claims. Label AI output and human-reviewed content separately.
- Phrase uncertainty directly. “Based on 8 verified papers” is acceptable; “will be on the exam” is not.
- Never show a fake “all content imported” badge.
