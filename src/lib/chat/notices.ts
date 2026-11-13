/**
 * Short notices appended to an answer the model could not finish, so a visitor
 * never sees a reply that stops mid-sentence (or no reply at all) without
 * explanation. Italian or English, guessed from the visitor's message — the
 * platform's bots are Italian and/or English.
 */

const IT_WORDS = /(?<![\p{L}])(?:il|lo|la|gli|le|di|del|della|delle|dei|che|per|non|sono|una|un|come|cosa|quali|quale|dove|quando|perch[eé]|grazie|ciao|buongiorno|buonasera|nel|nella|con|mi|ho|hai|[eè]|vorrei|posso|puoi|anche|soci|aziende|camera|iscriv\p{L}*)(?![\p{L}])/giu
// "i" and "in" are left out of both lists: they are common words in either language.
const EN_WORDS = /(?<![\p{L}])(?:the|is|are|what|which|how|where|when|who|do|does|can|could|you|my|for|with|and|of|to|please|thanks|thank|hi|hello|any|about|members?|companies|events?)(?![\p{L}])/giu

/** True when the text reads as Italian rather than English. */
export function looksItalian(text: string): boolean {
  const it = text.match(IT_WORDS)?.length ?? 0
  const en = text.match(EN_WORDS)?.length ?? 0
  return it > en
}

/** Appended when the answer was cut off (token limit, filter, upstream failure). */
export function truncationNotice(userMessage: string): string {
  return looksItalian(userMessage)
    ? '\n\n_(Risposta interrotta: scrivi «continua» per il resto.)_'
    : '\n\n_(Answer cut short: type “continue” for the rest.)_'
}

/** Sent instead of an answer when the model produced no text at all. */
export function failureNotice(userMessage: string): string {
  return looksItalian(userMessage)
    ? 'Mi dispiace, non sono riuscito a completare la risposta. Riprova tra qualche istante.'
    : "Sorry, I couldn't complete that answer. Please try again in a moment."
}
