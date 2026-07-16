'use client'

import React, { useEffect, useRef } from 'react'
import { ChatMessage, Message } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatThinkingIndicator } from './ChatThinkingIndicator'
import styles from './Chat.module.css'

export type { Message } from './ChatMessage'

export interface ChatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of messages to display */
  messages: Message[]
  /** Callback when user sends a message */
  onSendMessage: (content: string) => void
  /** Show loading state */
  isLoading?: boolean
  /** Type of loading state to display */
  loadingState?: 'thinking' | 'researching' | 'writing'
  /** Placeholder text for input */
  placeholder?: string
  /** Chat title shown in header */
  title?: string
  /** Optional slot for app-specific controls (mode toggles, settings, etc.) */
  toolingSlot?: React.ReactNode
  /** Additional CSS class */
  className?: string
  /** Inline style overrides merged onto the root element. */
  style?: React.CSSProperties
}

/**
 * Chat
 *
 * A complete chat interface with header, scrollable message list, and input area.
 * Supports user/AI/system messages, loading states, and custom app tooling.
 *
 * Features:
 * - Auto-scrolls to latest message
 * - Loading indicators with different states
 * - App-specific tooling slot in header
 * - Fully accessible with ARIA labels
 * - Brand-themed design with smooth animations
 */
export const Chat = React.forwardRef<HTMLDivElement, ChatProps>((
  {
    messages,
    onSendMessage,
    isLoading = false,
    loadingState = 'thinking',
    placeholder = 'Type a message...',
    title = 'Chat',
    toolingSlot,
    className = '',
    style,
    ...rest
  },
  ref
) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  return (
    // #281 — the OUTER element is both the container-query host (`.sizer`) and the
    // public root: it keeps the forwarded `ref` and the consumer `className`, so
    // the outermost element a consumer measures / styles is unchanged from before
    // the wrapper existed. The sizer fills the parent height so the chat still
    // stretches as before. The INNER `.chat` is a DESCENDANT of the host, so the
    // `@container chat` rules (which target `.chat` + children) match without a
    // self-rule no-op.
    <div
      ref={ref}
      className={`${styles.sizer} ${className}`}
      style={style}
      {...rest}
    >
      <div className={styles.chat}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {toolingSlot && (
            <div className={styles.tooling}>
              {toolingSlot}
            </div>
          )}
        </div>

        {/* Message List */}
        <div
          ref={messageListRef}
          className={styles.messageList}
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.length === 0 && !isLoading && (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No messages yet</p>
              <p className={styles.emptySubtext}>Start a conversation below</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <ChatThinkingIndicator state={loadingState} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <ChatInput
          onSend={onSendMessage}
          isLoading={isLoading}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
})

Chat.displayName = 'Chat'
