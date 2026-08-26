# ViralBoost Creator — Mobile Design Plan

## Product intent

ViralBoost Creator is an invite-only mobile companion for creators who want to turn their own permitted source media into reviewable platform-native adaptations. The app centers on a simple progression: import media, understand processing, review the strongest available drafts, make non-destructive refinements when desired, and approve the creator’s own next step. The product optimizes creator control, output quality, and measured learning; it does not promise virality, fame, or platform placement.

## Mobile design principles

The design assumes portrait 9:16 phone use and one-handed operation. It follows Apple Human Interface Guidelines through clear navigation, large touch targets, restrained surfaces, native sheets for focused work, and immediate feedback. Primary actions sit in the thumb zone near the lower portion of each screen; destructive or irreversible actions are never visually dominant.

The visual language is premium, editorial, and creator-focused: near-black navy surfaces, electric cyan for active workflow states, soft violet for intelligence, emerald for confirmed readiness, and amber for attention. Large media cards make the creator’s content—not dashboard chrome—the main visual object.

| Token | Color | Use |
|---|---|---|
| Ink | `#08111F` | App background and deep navigation surfaces |
| Surface | `#101D30` | Cards and elevated controls |
| Cyan | `#55E6FF` | Primary actions, selected states, active progress |
| Violet | `#9D8CFF` | Intelligence, recommendations, and edit states |
| Emerald | `#54D99C` | Ready, completed, and approved states |
| Amber | `#F6C65B` | Processing attention and recoverable warnings |
| Cloud | `#EDF5FF` | Primary text |
| Slate | `#91A3BC` | Supporting text and metadata |

## Screen list

| Screen | Primary content and functionality |
|---|---|
| **Welcome / Invite Access** | Concise private-access explanation, invite-code entry, and privacy boundary. The authenticated backend bridge is intentionally a later integration gate. |
| **Home** | A “Continue creating” hero, recent source cards, processing state, outcome summary, and the persistent “Add source” action. |
| **Add Source Sheet** | Camera roll / file import action, permissions guidance, private-upload boundary, upload progress, and queue confirmation. |
| **Processing Detail** | Source title, processing stage, percent, safe diagnostic message, and retry action only when the server permits it. |
| **Adaptation Review** | Platform-specific card stack with duration, format, artifact state, quality facts, private-preview placeholder, and creator approval readiness. |
| **Edit Lab** | Non-destructive trim range, focal composition, caption preference, headline, audio normalization, and a save-and-rerender action. Advanced controls are progressively disclosed. |
| **Learning** | Evidence-quality label, latest outcome facts, directional-versus-decision-ready guidance, and next recommended experiment. |
| **Profile / Privacy** | Invite-only workspace state, privacy explanation, app preferences, and logout. |

## Key user flows

### Beginner flow

The creator opens Home, taps **Add source**, chooses a permitted video, sees it enter private processing, and receives progress feedback. When a draft is ready, the creator opens Adaptation Review, swipes through platform-ready drafts, previews available artifacts, and chooses **Keep draft** or **Refine**. No publishing action occurs without an explicit creator approval flow.

### Advanced editor flow

The creator opens an adaptation and taps **Refine**. Edit Lab begins with simple trim and composition controls, while captions, headline, audio, and safe-zone guidance remain behind an **Advanced controls** disclosure. Saving creates a new recipe revision and shows a queued render state; it never overwrites the original source.

### Recovery flow

When a job is delayed or fails, Processing Detail uses a human-readable stage and safe diagnostic explanation. A retry control appears only if the backend permits it and shows the remaining retry budget. The creator never sees raw Redis, FFmpeg, or storage errors.

## Domain model

| Entity | Mobile meaning |
|---|---|
| **Workspace** | The creator’s private invited environment. |
| **SourceVideo** | Original permitted media, private processing status, durable source identity. |
| **Adaptation** | A platform-specific non-destructive recipe plus its artifact state. |
| **ClipCandidate** | A transparent, processor-backed possible trim range. It is not a claimed “best” moment. |
| **ProcessingDiagnostic** | Safe pipeline state, progress, issue category, and bounded recovery guidance. |
| **OutcomeScorecard** | Creator-specific evidence, freshness, and confidence—not a virality prediction. |

## Accessibility and interaction requirements

All key controls use labels, 44-point-or-larger hit targets, high-contrast text, and semantic state. Progress is written in addition to color. Motion remains subtle and respects reduced-motion settings. All creator-facing error messages explain the next safe action and never reveal infrastructure secrets.
