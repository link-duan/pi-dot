# pi-ui

Desktop UI for agent conversations in local project folders. Each Window binds at most one folder.

## Language

**Window**:
An OS window that is either empty or bound to exactly one project folder.
_Avoid_: Workspace, tab, pane, project window

**Session**:
A persisted conversation for a project, stored as a JSONL file.
_Avoid_: Chat, thread, conversation file

**Live Session**:
A Session currently loaded in memory.
_Avoid_: Runtime, open session

**Active Session**:
The Live Session shown in a Window. Each bound Window has one.
_Avoid_: Current session, focused session, foreground session

**Background Session**:
A Live Session that is still streaming and is not the Active Session of its Window.
_Avoid_: Hidden session, parked session

**Skill**:
An on-demand capability package, invoked as `/skill:name`.
_Avoid_: Slash command, command, prompt template

**Embed Chip**:
A visual token in the Composer or Transcript that stands for a Skill or a File. Skills serialize to `/skill:name`; files serialize to `@file:path`. Transcript projects those tokens back into chips.
_Avoid_: Mention, pill, tag

**File Chip**:
An Embed Chip for a file or directory. `@` in the Composer opens the file picker; sending serializes the chip to `@file:path`. Transcript only projects `@file:` tokens, never a bare `@path`.
_Avoid_: Mention, attachment

**Settings**:
App-level (global) configuration for providers, the model catalog, and agent behavior. Shared with the local Pi agent. A folder may also have `.pi/settings.json`, which overrides these app settings for that project.
_Avoid_: Preferences, options, config panel

**Provider**:
A model backend: a built-in catalog entry authenticated with credentials, or a custom endpoint in the model catalog.
_Avoid_: API, vendor, service

**Plan Mode**:
A per-Session toggle under which the agent explores read-only and writes a plan for approval instead of changing the project. The toggle is sent with the next prompt and takes effect at that run, then stays on until the user clicks Build: each run ends with the Plan File shown full-window, and a Review Plan card above the Composer reopens it or builds it. Build turns Plan Mode off and asks the agent to implement the plan.
_Avoid_: Planning mode, read-only mode, ask mode

**Plan File**:
The Markdown file one plan lives in, created by the agent's `create_plan` tool as `~/.pi-dot/plans/<name>_<hex>.plan.md` with `name` / `overview` frontmatter; a new plan means a new file. Until it is built it is the only file the agent may edit in Plan Mode, and the user may edit it too. Once built it stays read-only (a compact card keeps it viewable) until the next plan replaces it. Which file is current and whether it was built is replayed from the Session transcript.
_Avoid_: Plan document, todo list

**Question**:
A set of 1–4 multiple-choice questions the agent asks with its `ask_user` tool. The run waits until the user answers in a card above the Composer, picks an option or types their own answer per question, skips, or replies to all of them from the Composer. A pending Question is the running `ask_user` call, so it comes back with the Session.
_Avoid_: Prompt, dialog, questionnaire
