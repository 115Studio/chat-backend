export enum AiModel {
  // OpenAI Models Y
  OpenaiGpt4o = 'openai/gpt-4o',
  OpenaiGpt4oMini = 'openai/gpt-4o-mini',
  OpenaiGpt4Turbo = 'openai/gpt-4-turbo',
  OpenaiGpt4 = 'openai/gpt-4',
  OpenaiGpt35Turbo = 'openai/gpt-3.5-turbo',

  // Anthropic Claude Models Y
  AnthropicClaudeOpus4 = 'anthropic/claude-opus-4-20250514',
  AnthropicClaudeSonnet4 = 'anthropic/claude-sonnet-4-20250514',
  AnthropicClaudeSonnet37 = 'anthropic/claude-3-7-sonnet-20250219',
  AnthropicClaudeSonnet35V2 = 'anthropic/claude-3-5-sonnet-20241022',
  AnthropicClaudeSonnet35 = 'anthropic/claude-3-5-sonnet-20240620',
  AnthropicClaudeHaiku35 = 'anthropic/claude-3-5-haiku-20241022',
  AnthropicClaudeOpus3 = 'anthropic/claude-3-opus-20240229',
  AnthropicClaudeHaiku3 = 'anthropic/claude-3-haiku-20240307',

  // Google AI Studio Models Y
  GoogleGemini20Flash = 'google-ai-studio/gemini-2.0-flash',
  GoogleGemini25Flash = 'google-ai-studio/gemini-2.5-flash',
  GoogleGeminiPro = 'google-ai-studio/gemini-pro',

  // Groq Models Y
  GroqLlama31 = 'groq/llama-3.1-70b-versatile',
  GroqLlama38b = 'groq/llama-3.1-8b-instant',
  GroqMixtral = 'groq/mixtral-8x7b-32768',

  // Mistral AI Models Y
  MistralSmall31 = 'mistral-ai/mistral-small-3.1-24b-instruct',
  MistralLarge = 'mistral-ai/mistral-large-2411',
  MistralNemo = 'mistral-ai/mistral-nemo',

  // Cerebras Models Y
  CerebrasLlama33 = 'cerebras/llama-3.3-70b',
  CerebrasLlama31 = 'cerebras/llama-3.1-8b',

  // DeepSeek Models Y
  DeepseekCoder = 'deepseek/deepseek-coder',
  DeepseekChat = 'deepseek/deepseek-chat',

  // Perplexity Models Y
  PerplexityLlama31Sonar = 'perplexity/llama-3.1-sonar-large-128k-online',
  PerplexityLlama31SonarSmall = 'perplexity/llama-3.1-sonar-small-128k-online',

  // Cohere Models Y
  CohereCommandR = 'cohere/command-r',
  CohereCommandRPlus = 'cohere/command-r-plus',

  // Workers AI Models (Cloudflare) Y
  WorkersAiLlama31 = 'workers-ai/@cf/meta/llama-3.1-8b-instruct',
  WorkersAiLlama33 = 'workers-ai/@cf/meta/llama-3.3-70b-instruct',
  WorkersAiLlama4Scout = 'workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',

  // Grok Models Y
  GrokBeta = 'grok/grok-beta',
}
