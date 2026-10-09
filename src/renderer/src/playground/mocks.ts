import { createChatState, type ChatState } from '@/chat/state'
import type {
  AgentMessage,
  AssistantMessage,
  ContentBlock,
  ContextUsage,
  ModelInfo,
  ThinkingLevel,
  SkillInfo,
  ToolResultMessage,
  UserMessage,
} from '@shared/protocol'

let clock = Date.now() - 180_000
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

function imageResult(
  id: string,
  base64: string,
  mimeType = 'image/png',
  notice?: string,
): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: id,
    toolName: 'read',
    content: [
      {
        type: 'text',
        text: `Read image file [${mimeType}]${notice ? `\n${notice}` : ''}`,
      },
      {
        type: 'image',
        data: base64,
        mimeType,
      },
    ],
    isError: false,
    timestamp: at(),
  }
}

function codemodeResult(
  id: string,
  content: ContentBlock[],
  calls: unknown[],
  isError = false,
): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: id,
    toolName: 'codemode',
    content,
    details: { calls },
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
const sampleImage =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAFUElEQVR4nO2b228TRxTGv5nsbtbrGzYFO2ADzUNakLgGA6ECiQqJVgJKCKgPbRX1AcSfUCp6oSCK1JeqT+1bpaotBUICgVYtBaJWKpSQkohAUWpZQTHlEmJbdmwT766nDzRAyMXOrr2bYP+klVYzc+Z8c7QzPjPeJciDNWvWLIzHH26TZXkDwOYCzMsY3PnYGgUhiADkLkDCgiBcEEWxpaPj4s2cdhNVLl26YlM6PXRQluWV2Wy2cGoNgFIKjuPaJcmyr6ur45fx2o0ZgEAg4I3FUl9nMkObGGPFU2kAhBBUVlb+JAi2d7u7/7w3qv7ZgmXLAsvi8USLosjzjZFoDDzP3bbbHfWdne3tT5ePCEBtbe2KaDTRpiiq3Vh5xsBxFQmHw7m+s7O9c7iMDt8sX75uVjQ6ePx5HTwAKIpqj8cTJwOBgHe4rGL4xm63nZDlzEpzpBlHNqs6VRULBwb6vwP+nwKLFwc2xuPRs9NtpdcKIQQul/O1rq6/fqYAkEolPi2VwQMAYwzJZHo/AJDa2rqXHzzo/7uUAgA8yhNmznxhEZdMJuqzWdVsPYaTzapIp5NbqKoqG8wWYxaKIr/KKQrzTfNkTzOqmvVRgFWZLcQsGCNVHMBmACX6CCDrprkbPd+UfAA4xoBSXQQZA7hH879EIwBWngIlHwBOj7HVKmFt3Sq4XTPG7pyrQHX1AgBAKNQLRck/5c7HNhKN4Y+Ll5FMpiat/bEfxhi0nPv5fXPw7TdfwuuZrdl5Ibh77z7eemcP+sL/TtqWMR1rwO5djaYPHgC8ntnYvatRs73mAHg9szQ7LTR6tGgOwNlf2zQ7LTR6tGjOA441nYIkWdCwfQssFsuo+pnuGbBarSPKkskkBiKxnH3na5tOp9F0ohXHmk5pGgPAQObNq2ayLGswnpjDhz5AQ/3mEWVNzafx3vsHimo7GXieL+cBJR8AE/YCenwVWmd5L2D8dliPr0LrZKy8BhRzDRirz3x96bGdDOU1oByAkl8Ey3lAgXucdpQDYLYAs9F8JpiLsfrM15ce28mg60ywmKRT6VFlVV4vCJnwxVZN6DoWLxZ94Tujyl5Zuwq/t51BMBjC/f5+XLnSiabm01BVfW+3TMkn4Hzbb2M+7nOqPFi/rg47tm/F4UMf4sD+vbp90Sd5QKGv8chtGwr1ovnkmZzidzZshc1m1aWTAo8yokJf0ejow89oNJa3/ceffIaOjq6cQdCjESjiFDhytBmp1JO/rFKpFI4cbc7bPpFI4O3GPfj8i68wODg4Zpujx0+NW5cvZO5cP8tkCn8qDADV1fPx5s5tAIAfjrUgFLqlqZ/KSgGrV9XC7/fBM3sW3G4Xrl27juMnWnUtgoLAg/h8/sjQUMaluZdpjCAIAxQgo39zSgRCyB2OMXqbMSwyW4xJ3KY8z503W4VZ8Dx/jjocUjOlBMXLB6bmRSmBzSa1EgDw+fyXHz4cChQiqtMFUay8FA731VEAkCTLXkqnZFZcFAghEEXrR8BTH035fAt+TKdTr5snyzgkSWrt6+vdCjyVCYqiq5Hn+ZDZc7PYlyBwt5xO267hcT8OQDB4td9mc+7gOC6hMbBTHo7j4na7643u7u7HH1COmPjB4I2rDod7vSDwvYarKzKCIISdTvvGnp7rI3ZYFc82jET673o8L35PSHaRqio1xkksDpRSWCxiqyi6NweDN/55tn7CM6aampqNg4Opg5lMZvV0+6iKUgpBEC6JorQvFOo5N167vA7ZlixZ8lIsFt+mKMoGxuAHmJcxNsU+nycRgNwhBGGO485LkrPl5s2unlx2/wF09Ql7BCuqNwAAAABJRU5ErkJggg=='
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

export const playgroundContextUsage: ContextUsage = {
  tokens: 42_500,
  contextWindow: 256_000,
  percent: 17,
}

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

export const catalogModel = chat(
  [
    user(skillBlock),
    user('please use /skill:react-doctor on @file:src/app.ts:1-3'),
    user('Walk through the transcript states.'),
    assistant([
      { type: 'thinking', thinking: 'Plan the reply, then call tools.' },
      {
        type: 'text',
        text: [
          'Here is a **markdown** reply with `code`, math, and mermaid:',
          '',
          '- Inline math: $E = mc^2$ and $\\lim_{x \\to \\infty} \\frac{1}{x} = 0$',
          '- 自适应伸缩：保持 $5 \\to 4 \\to 3 \\to 2 \\to 1 \\to \\text{折叠}$ 的逐格单调阶梯收缩与扩展',
          '',
          'Block math formula:',
          '$$',
          '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
          '$$',
          '',
          'Mermaid diagrams:',
          '```mermaid',
          'graph TD',
          '  Client[客户端 App] -->|HTTPS 请求| Gateway[API 网关]',
          '  Gateway -->|业务请求| CoreAPI[核心业务服务]',
          '  CoreAPI -->|读取缓存| Cache[(Redis 集群)]',
          '  CoreAPI -->|持久化存储| DB[(PostgreSQL)]',
          '  CoreAPI -->|异步消息| MQ>Kafka 消息队列]',
          '  MQ --> Worker[后台异步 Worker]',
          '```',
          '',
          '```mermaid',
          'stateDiagram-v2',
          '  [*] --> Running: 调度执行',
          '  Running --> Success: 执行完成',
          '  Running --> Failed: 执行抛错',
          '  Failed --> DeadLetter: 超过最大重试次数',
          '  Success --> [*]',
          '  DeadLetter --> [*]',
          '```',
        ].join('\n'),
      },
      tool('read-1', 'read', { path: src, offset: 1, limit: 3 }),
      tool('read-img', 'read', { path: 'public/favicon.png' }),
      tool('bash-ok', 'bash', { command: 'ls --color=always src' }),
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
    imageResult('read-img', sampleImage, 'image/png', '[Image resized from 512x512 to 64x64.]'),
    result(
      'bash-ok',
      'bash',
      '\x1b[1;34mdir/\x1b[0m\n\x1b[32mapp.ts\x1b[0m\n\x1b[33mmain.tsx\x1b[0m',
    ),
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
      stopReason: 'aborted',
      errorMessage: 'Request aborted',
      timestamp: at(101_000),
    }),
    user('Try again.'),
    assistant([{ type: 'thinking', thinking: 'Retry the previous edit.' }], {
      stopReason: 'error',
      errorMessage: 'Error Code internal_server_error: Internal error during token generation',
    }),
  ],
  {
    steeringQueue: ['Ensure all tests pass before committing'],
    followUpQueue: ['Run integration tests', 'Update documentation'],
  },
)

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
    steeringQueue: ['Stop after reading the first 50 lines'],
    followUpQueue: ['Compare with main branch'],
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
    steeringQueue: ['Focus on edge cases and error recovery'],
    followUpQueue: ['Add unit tests for the new handler'],
  },
)

export const queuedModel = chat(
  [
    user('Refactor the auth service.'),
    assistant([{ type: 'text', text: 'Splitting into modular providers...' }]),
  ],
  {
    isStreaming: true,
    assistantStreaming: true,
    turnActive: true,
    turnStartedAt: clock - 3_600,
    steeringQueue: ['Focus on OAuth provider first'],
    followUpQueue: ['Run integration tests', 'Update documentation'],
  },
)

const codemodeScript = [
  '// Gather project metadata in parallel, then summarize it.',
  'const [pkg, tsconfig, status] = await Promise.all([',
  '  tools.read({ path: "package.json" }),',
  '  tools.read({ path: "tsconfig.json" }),',
  '  tools.bash({ command: "git status --short" }),',
  '])',
  'const meta = JSON.parse(pkg)',
  'const compiler = JSON.parse(tsconfig).compilerOptions ?? {}',
  'const dirty = status.split("\\n").filter(Boolean)',
  '',
  '// Find TODOs left in the source tree.',
  'const todos = await tools.grep({ pattern: "TODO", path: "src" })',
  'const todoCount = todos.split("\\n").filter(Boolean).length',
  '',
  'text(`${meta.name}@${meta.version}`)',
  'text(`strict: ${compiler.strict}, target: ${compiler.target}`)',
  'text(`${dirty.length} dirty files, ${todoCount} TODOs`)',
  'image(await tools.read({ path: "public/favicon.png" }))',
  'console.log("done")',
].join('\n')
const longCommand = `echo ${'x'.repeat(400)} | wc -c`
const header = (status: 'completed' | 'failed', seconds: number) => ({
  type: 'text' as const,
  text: `Script ${status}\nWall time ${seconds} seconds\nOutput:\n`,
})

export const codemodeModel = chat(
  [
    user('Summarize the project metadata.'),
    assistant([tool('cm-ok', 'codemode', { code: codemodeScript })]),
    codemodeResult(
      'cm-ok',
      [
        header('completed', 1.4),
        {
          type: 'text',
          text: '==> text 1/3 <==\npi-ui@0.1.0\n==> text 2/3 <==\nstrict: true, target: ES2022\n==> text 3/3 <==\n3 dirty files, 7 TODOs',
        },
        { type: 'image', data: sampleImage, mimeType: 'image/png' },
        { type: 'text', text: '<console_output>\ndone\n</console_output>' },
      ],
      [
        {
          id: 'cm-ok/1',
          name: 'read',
          args: '{"path":"package.json"}',
          status: 'ok',
          durationMs: 3.6,
        },
        {
          id: 'cm-ok/2',
          name: 'read',
          args: '{"path":"tsconfig.json"}',
          status: 'ok',
          durationMs: 2.1,
        },
        {
          id: 'cm-ok/3',
          name: 'bash',
          args: '{"command":"git status --short"}',
          status: 'ok',
          durationMs: 1240,
        },
        {
          id: 'cm-ok/4',
          name: 'grep',
          args: '{"pattern":"TODO","path":"src"}',
          status: 'ok',
          durationMs: 38,
        },
        {
          id: 'cm-ok/5',
          name: 'read',
          args: '{"path":"public/favicon.png"}',
          status: 'ok',
          durationMs: 5,
        },
      ],
    ),
    user('Delete the build output.'),
    assistant([
      tool('cm-fail', 'codemode', {
        code: 'text("cleaning")\nawait Promise.all([\n  tools.read({ path: "dist/manifest.json" }),\n  tools.bash({ command: "rm -rf dist" }),\n])',
      }),
    ]),
    codemodeResult(
      'cm-fail',
      [
        header('failed', 0.2),
        {
          type: 'text',
          text: "cleaning\nScript error:\nError: ENOENT: no such file or directory, access 'dist/manifest.json'\n\nTool calls made before the failure (they are not undone): read (error), bash (cancelled)",
        },
      ],
      [
        {
          id: 'cm-fail/1',
          name: 'read',
          args: '{"path":"dist/manifest.json"}',
          status: 'error',
          durationMs: 1,
          error: "ENOENT: no such file or directory, access 'dist/manifest.json'",
        },
        {
          id: 'cm-fail/2',
          name: 'bash',
          args: '{"command":"rm -rf dist"}',
          status: 'cancelled',
          durationMs: 4,
        },
      ],
      true,
    ),
    user('Classify the long payload.'),
    assistant([
      tool('cm-long', 'codemode', {
        code: `const out = await tools.bash({ command: ${JSON.stringify(longCommand)} })\nconst label = await models.classify({ input: out, labels: ["small", "large"] })\ntext(label)`,
      }),
    ]),
    codemodeResult(
      'cm-long',
      [header('completed', 2.3), { type: 'text', text: 'large' }],
      [
        {
          id: 'cm-long/1',
          name: 'bash',
          // The SDK truncates args to 200 characters for display.
          args: `${JSON.stringify({ command: longCommand }).slice(0, 197)}...`,
          status: 'ok',
          durationMs: 11,
        },
        {
          id: 'cm-long/2',
          name: 'models.classify',
          args: '{"labels":["small","large"]}',
          status: 'ok',
          durationMs: 2210,
          cost: 0.0042,
        },
      ],
    ),
    user('What is 6 times 7?'),
    assistant([tool('cm-plain', 'codemode', { code: 'text(6 * 7)' })]),
    codemodeResult('cm-plain', [header('completed', 0), { type: 'text', text: '42' }], []),
    user('Run the slow checks.'),
    assistant([
      tool('cm-run', 'codemode', {
        code: 'await Promise.all([\n  tools.bash({ command: "bun run typecheck" }),\n  tools.bash({ command: "bun run test" }),\n])',
      }),
    ]),
  ],
  {
    isStreaming: true,
    turnActive: true,
    turnStartedAt: clock - 6_000,
    toolLive: {
      'cm-run': {
        toolCallId: 'cm-run',
        toolName: 'codemode',
        args: {
          code: 'await Promise.all([\n  tools.bash({ command: "bun run typecheck" }),\n  tools.bash({ command: "bun run test" }),\n])',
        },
        status: 'running',
        partialResult: {
          content: [],
          details: {
            calls: [
              {
                id: 'cm-run/1',
                name: 'bash',
                args: '{"command":"bun run typecheck"}',
                status: 'ok',
                durationMs: 4800,
              },
              {
                id: 'cm-run/?',
                name: 'bash',
                args: '{"command":"bun run test"}',
                status: 'running',
              },
            ],
          },
        },
      },
    },
  },
)
