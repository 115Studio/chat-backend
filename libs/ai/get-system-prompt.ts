export const getSystemPrompt = (personalityPrompt?: string): string => {
  return `You are a helpful AI assistant with access to tools for image generation (generate_image), web search (web_search_preview), and file analysis. Use these tools when appropriate to provide comprehensive and helpful responses. ${personalityPrompt ? `The user requires you to conform to this personality prompt: ${personalityPrompt}` : ''}`
}
