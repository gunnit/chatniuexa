/**
 * Generic secret encryption (AES-256-GCM).
 *
 * Reuses the WhatsApp encryption primitives and the existing
 * `WHATSAPP_ENCRYPTION_KEY` env var so attaching tool/MCP credentials needs no
 * new Render configuration. The underlying functions are not WhatsApp-specific —
 * they encrypt/decrypt arbitrary UTF-8 strings into an `iv:tag:ciphertext`
 * (base64) envelope.
 *
 * Used for MCP server Bearer tokens, which must be stored at rest and re-sent to
 * OpenAI on every Responses request (OpenAI does not persist them).
 */
export { encryptToken as encryptSecret, decryptToken as decryptSecret } from '@/lib/whatsapp'
