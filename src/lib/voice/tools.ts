// Function tools exposed to the realtime voice model. These are sent in the session
// config at mint time. When the model calls one, the browser round-trips to our
// /api/voice/{retrieve,lead} endpoints and returns the result as a function_call_output.

export const SEARCH_KNOWLEDGE_TOOL = {
  type: 'function' as const,
  name: 'search_knowledge',
  description:
    "Search the company's knowledge base for information needed to answer the visitor's question. " +
    'ALWAYS call this before answering any factual question about the company, its products, ' +
    'services, people, or content. Pass the visitor\'s question as a concise search query.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "A concise search query capturing what the visitor wants to know.",
      },
    },
    required: ['query'],
  },
}

export const CAPTURE_LEAD_TOOL = {
  type: 'function' as const,
  name: 'capture_lead',
  description:
    'Save the visitor\'s contact details when they ask to be contacted, leave their information, ' +
    'request a callback, a quote, or a demo. Call this once you have at least a name or an email or ' +
    'a phone number. Confirm back to the visitor that their details were saved.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name, if given." },
      email: { type: 'string', description: "The visitor's email address, if given." },
      phone: { type: 'string', description: "The visitor's phone number, if given." },
      note: { type: 'string', description: 'A short note on what the visitor wants (reason for contact).' },
    },
    required: [],
  },
}

export const VOICE_TOOLS = [SEARCH_KNOWLEDGE_TOOL, CAPTURE_LEAD_TOOL]
