# pi-ui

Desktop UI for one project folder and the agent conversations in it.

## Language

**Session**:
A persisted conversation for a project, stored as a JSONL file.
_Avoid_: Chat, thread, conversation file

**Live Session**:
A Session currently loaded in memory.
_Avoid_: Runtime, open session

**Active Session**:
The Live Session shown in the UI.
_Avoid_: Current session, focused session, foreground session

**Background Session**:
A Live Session that is still streaming and is not the Active Session.
_Avoid_: Hidden session, parked session

**Skill**:
An on-demand capability package, invoked as `/skill:name`.
_Avoid_: Slash command, command, prompt template

**Embed Chip**:
A visual token in the Composer or Transcript that stands for a Skill. Sending serializes it to `/skill:name`; Transcript projects stored skill blocks and `/skill:name` tokens back into chips.
_Avoid_: Mention, pill, tag
