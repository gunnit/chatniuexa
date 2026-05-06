import crypto from 'crypto'
import { logger } from '@/lib/logger'

const GRAPH_API_VERSION = 'v23.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const WHATSAPP_MAX_LENGTH = 4096

// ─────────────────────────────────────────────────────────────
// Token Encryption (AES-256-GCM)
// ─────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const key = process.env.WHATSAPP_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('WHATSAPP_ENCRYPTION_KEY must be a 64-char hex string')
  }
  return Buffer.from(key, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

// ─────────────────────────────────────────────────────────────
// Webhook Signature Verification
// ─────────────────────────────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false
  const provided = signatureHeader.replace('sha256=', '')
  // HMAC-SHA256 hex is exactly 64 chars; reject anything else before timingSafeEqual
  // (which throws on length mismatch).
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex')
    )
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// Parse Incoming Messages
// ─────────────────────────────────────────────────────────────

export interface ParsedWhatsAppMessage {
  from: string          // Sender's phone number (wa_id)
  text: string          // Message text body
  messageId: string     // WhatsApp message ID
  phoneNumberId: string // Receiving phone number ID
  timestamp: string
  type: string          // 'text', 'image', 'audio', etc.
  senderName?: string
}

export function parseIncomingMessages(body: unknown): ParsedWhatsAppMessage[] {
  const messages: ParsedWhatsAppMessage[] = []

  try {
    const payload = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string }
            contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
            messages?: Array<{
              from?: string
              id?: string
              timestamp?: string
              type?: string
              text?: { body?: string }
            }>
          }
        }>
      }>
    }

    if (!payload.entry) return messages

    for (const entry of payload.entry) {
      if (!entry.changes) continue
      for (const change of entry.changes) {
        const value = change.value
        if (!value?.messages) continue

        const phoneNumberId = value.metadata?.phone_number_id || ''
        const contacts = value.contacts || []

        for (const msg of value.messages) {
          if (!msg.from || !msg.id) continue
          const contact = contacts.find((c) => c.wa_id === msg.from)
          messages.push({
            from: msg.from,
            text: msg.type === 'text' ? (msg.text?.body || '') : '',
            messageId: msg.id,
            phoneNumberId,
            timestamp: msg.timestamp || '',
            type: msg.type || 'unknown',
            senderName: contact?.profile?.name,
          })
        }
      }
    }
  } catch (error) {
    logger.error('Failed to parse WhatsApp webhook payload', { error: String(error) })
  }

  return messages
}

// ─────────────────────────────────────────────────────────────
// Send Message
// ─────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<{ messageId: string }> {
  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    logger.error('WhatsApp API error', { status: response.status, body: errorBody })
    throw new Error(`WhatsApp API error: ${response.status}`)
  }

  const data = await response.json()
  return { messageId: data.messages?.[0]?.id || '' }
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export function splitMessage(text: string, maxLength = WHATSAPP_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }
    // Try to split at a newline or space near the limit
    let splitAt = remaining.lastIndexOf('\n', maxLength)
    if (splitAt < maxLength * 0.5) {
      splitAt = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitAt < maxLength * 0.5) {
      splitAt = maxLength
    }
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}
