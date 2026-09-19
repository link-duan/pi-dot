import { createChatState, type ChatState } from '@/chat/state'
import type {
  AgentMessage,
  AssistantMessage,
  ContentBlock,
  ModelInfo,
  ThinkingLevel,
  SkillInfo,
  ToolResultMessage,
  UserMessage,
} from '@shared/protocol'

let clock = 1_704_067_200_000
function at(delta = 800): number {
  clock += delta
  return clock
}

function user(text: string): UserMessage {
  return { role: 'user', content: text, timestamp: at(12_000) }
}

function assistant(content: ContentBlock[], extra?: Partial<AssistantMessage>): AssistantMessage {
  return { role: 'assistant', content, timestamp: at(), ...extra }
}

function tool(
  id: string,
  name: string,
  args: unknown,
): Extract<ContentBlock, { type: 'toolCall' }> {
  return { type: 'toolCall', id, name, arguments: args }
}

function result(id: string, toolName: string, text: string, isError = false): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: id,
    toolName,
    content: [{ type: 'text', text }],
    isError,
    timestamp: at(),
  }
}

function chat(messages: AgentMessage[], extra: Partial<ChatState> = {}): ChatState {
  return {
    ...createChatState(),
    messages,
    persistedAt: messages.map((message) => message.timestamp),
    ...extra,
  }
}

const src = 'src/app.ts'
const readBody = `export function greet(name: string) {\n  return \`hello \${name}\`\n}\n\n[Showing lines 1-3 of 40]`

export const playgroundModel: ModelInfo = {
  id: 'claude-sonnet-4-5',
  name: 'Claude Sonnet 4.5',
  provider: 'anthropic',
}

export const playgroundModels: ModelInfo[] = [
  playgroundModel,
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai' },
]

export const playgroundThinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high']

export const playgroundSkills: SkillInfo[] = [
  { name: 'tdd', description: 'Test-driven development' },
  { name: 'react-doctor', description: 'Scan React diagnostics' },
]

export const emptyModel = chat([])

const skillBlock = [
  '<skill name="tdd" location="/tmp/tdd/SKILL.md">',
  'References are relative to /tmp/tdd.',
  '',
  'Write tests first.',
  '</skill>',
  '',
  'fix the failing test',
].join('\n')

export const catalogModel = chat([
  user(skillBlock),
  user('please use /skill:react-doctor on @file:src/app.ts:1-3'),
  user('Walk through the transcript states.'),
  assistant([
    { type: 'thinking', thinking: 'Plan the reply, then call tools.' },
    {
      type: 'text',
      text: 'Here is a **markdown** reply with `code` and a list:\n\n- one\n- two',
    },
    tool('read-1', 'read', { path: src, offset: 1, limit: 3 }),
    tool('bash-ok', 'bash', { command: 'ls -la src' }),
    tool('bash-err', 'bash', { command: 'cat missing.txt' }),
    tool('grep-1', 'grep', { pattern: 'greet', path: 'src' }),
    tool('find-1', 'find', { pattern: '**/*.ts' }),
    tool('ls-1', 'ls', { path: 'src' }),
    tool('write-ok', 'write', { path: 'src/hello.ts', content: 'export const n = 1\n' }),
    tool('write-fail', 'write', { path: 'src/locked.ts', content: 'nope\n' }),
    tool('edit-ok', 'edit', {
      path: src,
      edits: [{ oldText: 'hello ${name}', newText: 'hi ${name}' }],
    }),
    tool('edit-fail', 'edit', {
      path: src,
      edits: [{ oldText: 'missing', newText: 'other' }],
    }),
    tool('custom-1', 'weather', { city: 'Tokyo' }),
  ]),
  result('read-1', 'read', readBody),
  result('bash-ok', 'bash', 'app.ts\nmain.tsx'),
  result('bash-err', 'bash', 'cat: missing.txt: No such file or directory', true),
  result('grep-1', 'grep', 'src/app.ts:2:  return `hello ${name}`'),
  result('find-1', 'find', 'src/app.ts\nsrc/main.tsx'),
  result('ls-1', 'ls', 'app.ts\nmain.tsx'),
  result('write-ok', 'write', 'Wrote src/hello.ts'),
  result('write-fail', 'write', 'EACCES: permission denied', true),
  result('edit-ok', 'edit', 'Edited src/app.ts'),
  result('edit-fail', 'edit', 'oldText not found', true),
  result('custom-1', 'weather', '22°C, clear'),
  { role: 'compactionSummary', summary: 'Dropped older tool output.', timestamp: at() },
  user('Stop if this takes too long.'),
  assistant([{ type: 'text', text: 'Working on it.' }], {
    errorMessage: 'Request aborted',
    timestamp: at(101_000),
  }),
  user('Try again.'),
  assistant([{ type: 'thinking', thinking: 'Retry the previous edit.' }], {
    errorMessage: 'Error Code internal_server_error: Internal error during token generation',
  }),
])

export const thinkingModel = chat(
  [
    user('What should we change?'),
    assistant([{ type: 'thinking', thinking: 'Considering the layout and error treatment.' }]),
  ],
  {
    isStreaming: true,
    assistantStreaming: true,
    turnActive: true,
    turnStartedAt: clock - 4_200,
  },
)

export const runningToolModel = chat(
  [user('Read the file.'), assistant([tool('read-run', 'read', { path: src })])],
  {
    isStreaming: true,
    turnActive: true,
    turnStartedAt: clock - 2_800,
    toolLive: {
      'read-run': {
        toolCallId: 'read-run',
        toolName: 'read',
        args: { path: src },
        status: 'running',
      },
    },
  },
)

export const waitingModel = chat([user('Ping.')], {
  isStreaming: true,
  turnActive: false,
  turnStartedAt: clock - 1_500,
})

export const workingModel = chat(
  [user('Keep going.'), assistant([{ type: 'text', text: 'Almost there' }])],
  {
    isStreaming: true,
    assistantStreaming: true,
    turnActive: true,
    turnStartedAt: clock - 3_600,
  },
)
