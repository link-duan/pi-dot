const thinkingLevelMap = {
  type: 'object',
  description:
    'Maps Pi thinking levels to provider values. Omit a level for the default mapping; use null to hide it; use a string to send that value.',
  additionalProperties: { type: ['string', 'null'] },
  properties: {
    off: {
      type: ['string', 'null'],
      description: 'Value sent for thinking off, or null if thinking cannot be disabled.',
    },
    minimal: { type: ['string', 'null'], description: 'Minimal thinking level.' },
    low: { type: ['string', 'null'], description: 'Low thinking level.' },
    medium: { type: ['string', 'null'], description: 'Medium thinking level.' },
    high: { type: ['string', 'null'], description: 'High thinking level.' },
    xhigh: { type: ['string', 'null'], description: 'Extra-high thinking level.' },
    max: { type: ['string', 'null'], description: 'Maximum thinking level.' },
  },
}

const cost = {
  type: 'object',
  description: 'Per-million-token rates. Optional request-wide input pricing tiers.',
  additionalProperties: true,
  properties: {
    input: { type: 'number', description: 'Input cost per million tokens.' },
    output: { type: 'number', description: 'Output cost per million tokens.' },
    cacheRead: { type: 'number', description: 'Cache-read cost per million tokens.' },
    cacheWrite: { type: 'number', description: 'Cache-write cost per million tokens.' },
  },
}

const compat = {
  type: 'object',
  description:
    'Provider compatibility flags. Set at provider level as defaults, or on a model to override.',
  additionalProperties: true,
  properties: {
    supportsStore: {
      type: 'boolean',
      description: 'Whether the provider accepts the store field.',
    },
    supportsDeveloperRole: {
      type: 'boolean',
      description:
        'Use the developer role instead of system. Disable for Ollama and many local servers.',
    },
    supportsReasoningEffort: {
      type: 'boolean',
      description: 'Whether the provider accepts reasoning_effort.',
    },
    supportsUsageInStreaming: {
      type: 'boolean',
      description: 'Supports stream_options.include_usage. Default true.',
    },
    supportsFinishReason: {
      type: 'boolean',
      description: 'Whether streamed responses include finish_reason.',
    },
    maxTokensField: {
      enum: ['max_completion_tokens', 'max_tokens'],
      description: 'Which field to send for the output token cap.',
    },
    requiresToolResultName: {
      type: 'boolean',
      description: 'Include name on tool result messages.',
    },
    requiresAssistantAfterToolResult: {
      type: 'boolean',
      description: 'Insert an assistant message before a user message after tool results.',
    },
    requiresThinkingAsText: {
      type: 'boolean',
      description: 'Convert thinking blocks to plain text.',
    },
    requiresReasoningContentOnAssistantMessages: {
      type: 'boolean',
      description:
        'Include empty reasoning_content on replayed assistant messages when reasoning is on.',
    },
    thinkingFormat: {
      enum: [
        'openai',
        'openrouter',
        'together',
        'baseten',
        'deepseek',
        'zai',
        'qwen',
        'chat-template',
        'qwen-chat-template',
        'string-thinking',
        'ant-ling',
      ],
      description: 'How thinking/reasoning parameters are serialized for this API.',
      enumDescriptions: [
        'OpenAI reasoning_effort',
        'OpenRouter reasoning.effort',
        'Together reasoning.enabled',
        'Baseten chat_template_args',
        'DeepSeek reasoning_content',
        'Z.AI thinking payload',
        'Qwen enable_thinking',
        'vLLM/HF chat_template_kwargs',
        'Qwen chat_template_kwargs.enable_thinking',
        'Thinking as a string field',
        'Ant Ling thinking format',
      ],
    },
    thinkingTokenBudgetField: {
      enum: ['thinking_token_budget', 'thinking_budget', 'thinking_budget_tokens'],
      description: 'Top-level request field used to cap reasoning tokens from thinkingBudgets.',
    },
    cacheControlFormat: {
      const: 'anthropic',
      description: 'Use Anthropic-style cache_control markers on OpenAI-compatible APIs.',
    },
    sendSessionAffinityHeaders: {
      type: 'boolean',
      description: 'Send session-affinity headers from the session id when caching is enabled.',
    },
    sessionAffinityFormat: {
      enum: ['openai', 'openai-nosession', 'openrouter'],
      description: 'Session-affinity header format.',
    },
    supportsStrictMode: {
      type: 'boolean',
      description: 'Whether the provider accepts strict JSON-schema function tools.',
    },
    supportsOpenAIGrammarTools: {
      type: 'boolean',
      description: 'Whether OpenAI-compatible APIs emit custom Lark/regex grammar tools.',
    },
    supportsLongCacheRetention: {
      type: 'boolean',
      description:
        'Whether the provider accepts long cache retention (1h / 24h / 30m depending on API).',
    },
    deferredToolsMode: { const: 'kimi', description: 'Kimi deferred tool serialization.' },
    supportsEagerToolInputStreaming: {
      type: 'boolean',
      description: 'Anthropic: accept per-tool eager_input_streaming. Default true.',
    },
    supportsCacheControlOnTools: {
      type: 'boolean',
      description: 'Anthropic: accept cache_control on tool definitions.',
    },
    supportsTemperature: {
      type: 'boolean',
      description: 'Anthropic-compatible: accept temperature.',
    },
    forceAdaptiveThinking: {
      type: 'boolean',
      description: 'Send adaptive thinking (thinking.type adaptive plus output_config.effort).',
    },
    allowEmptySignature: {
      type: 'boolean',
      description:
        'Replay empty thinking signatures as signature: "". Real Anthropic rejects this.',
    },
    supportsStrictTools: {
      type: 'boolean',
      description: 'Anthropic: accept strict JSON-schema tool definitions.',
    },
    supportsMidConvoEffort: {
      type: 'boolean',
      description: 'Claude per-turn effort system messages and thinking binding controls.',
    },
    supportsToolReferences: { type: 'boolean', description: 'Anthropic tool references support.' },
    supportsAdditionalTools: { type: 'boolean', description: 'Google: additional tools support.' },
    supportsToolSearch: { type: 'boolean', description: 'Google: tool search support.' },
    supportsMaxOutputTokens: { type: 'boolean', description: 'Google: max output tokens field.' },
    vllmPriority: { type: 'number', description: 'vLLM request priority.' },
    chatTemplateKwargs: {
      type: 'object',
      description: 'chat_template_kwargs for thinkingFormat chat-template. Values may use $var.',
    },
    chatTemplateArgs: {
      type: 'object',
      description: 'chat_template_args for thinkingFormat baseten. Values may use $var.',
    },
    openRouterRouting: {
      type: 'object',
      additionalProperties: true,
      description: 'OpenRouter provider routing object, sent as the provider field.',
    },
    vercelGatewayRouting: {
      type: 'object',
      description: 'Vercel AI Gateway routing (only / order).',
      properties: {
        only: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict to these providers.',
        },
        order: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred provider order.',
        },
      },
    },
  },
}

const model = {
  type: 'object',
  additionalProperties: true,
  required: ['id'],
  description: 'A model under this provider.',
  properties: {
    id: { type: 'string', minLength: 1, description: 'Model id sent to the API.' },
    name: { type: 'string', description: 'Human-readable label. Defaults to id.' },
    api: { type: 'string', description: 'Override the provider API type for this model.' },
    baseUrl: { type: 'string', description: 'Override the provider base URL for this model.' },
    reasoning: { type: 'boolean', description: 'Supports extended thinking / reasoning.' },
    thinkingLevelMap,
    input: {
      type: 'array',
      items: { enum: ['text', 'image'] },
      description: 'Accepted input types. Default ["text"]. Include "image" for vision.',
    },
    cost,
    contextWindow: {
      type: 'number',
      description: 'Context window size in tokens. Default 128000.',
    },
    maxTokens: { type: 'number', description: 'Maximum output tokens. Default 16384.' },
    samplingParams: {
      type: 'object',
      description: 'Merged verbatim into every OpenAI-compatible request body.',
    },
    headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Extra HTTP headers for this model. Supports $ENV and !command values.',
    },
    compat,
  },
}

const provider = {
  type: 'object',
  additionalProperties: true,
  description:
    'Custom or overridden provider. Built-in providers can be patched by using the same id.',
  properties: {
    name: { type: 'string', description: 'Display name. Defaults to the provider id.' },
    baseUrl: { type: 'string', description: 'API endpoint URL.' },
    apiKey: {
      type: 'string',
      description: 'API key, $ENV_VAR, or !command. Omit when auth comes from /login or auth.json.',
    },
    api: {
      enum: [
        'openai-completions',
        'openai-responses',
        'anthropic-messages',
        'google-generative-ai',
      ],
      description: 'API protocol for this provider.',
      enumDescriptions: [
        'OpenAI Chat Completions (most compatible)',
        'OpenAI Responses API',
        'Anthropic Messages API',
        'Google Generative AI',
      ],
    },
    oauth: { const: 'radius', description: 'Dynamic OAuth provider type. Currently only radius.' },
    headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Extra HTTP headers. Supports $ENV and !command values.',
    },
    authHeader: {
      type: 'boolean',
      description: 'Send Authorization: Bearer <apiKey> automatically.',
    },
    compat,
    models: { type: 'array', items: model, description: 'Models advertised by this provider.' },
    modelOverrides: {
      type: 'object',
      additionalProperties: model,
      description: 'Patch built-in or extension models by id without replacing the full list.',
    },
  },
}

export const modelsJsonSchema = {
  $id: 'pi://models.json',
  title: 'Pi models.json',
  description: 'Custom providers and models for Pi. Comments and trailing commas are allowed.',
  type: 'object',
  additionalProperties: true,
  properties: {
    providers: {
      type: 'object',
      description: 'Map of provider id → provider config.',
      additionalProperties: provider,
    },
  },
}
