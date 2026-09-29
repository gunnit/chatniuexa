/**
 * Live check that OpenAI accepts the request parameters our chat paths send for
 * every model in the registry (src/lib/models.ts): reasoning effort, plus
 * `temperature` wherever `supportsTemperature` says so. A wrong flag means a 400
 * on every message for bots on that model, so run this after adding or changing
 * a model.
 *
 * Sends 3 tiny requests per model: Chat Completions, Responses, and Responses
 * with the web_search tool attached (tool_choice "none", so no search is billed).
 *
 * Requires OPENAI_API_KEY.
 *
 * Usage:
 *   npx tsx scripts/check-chat-model-params.ts
 */
import { getOpenAI } from '../src/lib/openai'
import {
  CHAT_MODELS,
  chatCompletionsReasoning,
  responsesReasoning,
  supportsTemperature,
  temperatureParam,
} from '../src/lib/models'

const PROMPT = 'Reply with the single word "ok".'
const TEMPERATURE = 0.7

async function main() {
  const openai = getOpenAI()
  let failures = 0

  for (const { id } of CHAT_MODELS) {
    const checks: Array<[string, () => Promise<unknown>]> = [
      ['chat.completions', () =>
        openai.chat.completions.create({
          model: id,
          messages: [{ role: 'user', content: PROMPT }],
          max_completion_tokens: 16,
          ...chatCompletionsReasoning(id),
          ...temperatureParam(id, TEMPERATURE),
        })],
      ['responses', () =>
        openai.responses.create({
          model: id,
          input: PROMPT,
          max_output_tokens: 16,
          ...responsesReasoning(id),
          ...temperatureParam(id, TEMPERATURE),
        })],
      ['responses+web_search', () =>
        openai.responses.create({
          model: id,
          input: PROMPT,
          tools: [{ type: 'web_search' }],
          tool_choice: 'none',
          max_output_tokens: 16,
          ...responsesReasoning(id),
          ...temperatureParam(id, TEMPERATURE),
        })],
    ]

    for (const [api, run] of checks) {
      const sent = supportsTemperature(id) ? `temperature ${TEMPERATURE}` : 'no temperature'
      try {
        await run()
        console.log(`ok    ${id.padEnd(14)} ${api.padEnd(22)} ${sent}`)
      } catch (error) {
        failures++
        console.log(`FAIL  ${id.padEnd(14)} ${api.padEnd(22)} ${sent}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  console.log(failures ? `\n${failures} request(s) rejected — fix the model's entry in src/lib/models.ts` : '\nAll models accept the parameters we send.')
  process.exit(failures ? 1 : 0)
}

main()
