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
