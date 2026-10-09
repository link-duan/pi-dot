import {
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  type InlineExtension,
} from '@earendil-works/pi-coding-agent'

export const builtinExtensions: InlineExtension[] = [
  { name: 'codemode', factory: createCodemodeExtension(), builtin: true, replaceable: true },
  { name: 'tool-search', factory: createToolSearchExtension(), builtin: true, replaceable: true },
  { name: 'mcp', factory: createMcpExtension(), builtin: true, replaceable: true },
]
