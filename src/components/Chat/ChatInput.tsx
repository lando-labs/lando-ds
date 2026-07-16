'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '../Button'
import styles from './ChatInput.module.css'

export interface ChatInputProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Callback when message is sent */
  onSend: (message: string) => void
  /** Disable input when loading */
  isLoading?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Maximum height for textarea */
  maxHeight?: string
  /** Additional CSS class */
  className?: string
}

/**
 * ChatInput
 *
 * Multi-line input area with auto-expanding textarea and send button.
 * Supports keyboard shortcuts (Cmd+Enter or Ctrl+Enter to send).
 */
export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>((
  {
    onSend,
    isLoading = false,
    placeholder = 'Type a message...',
    maxHeight = '200px',
    className = '',
    style,
    ...rest
  },
  ref
) => {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim())
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const maxHeightPx = parseInt(maxHeight)
      textarea.style.height = `${Math.min(scrollHeight, maxHeightPx)}px`
    }
  }, [message, maxHeight])

  return (
    // #281 — the OUTER element is both the container-query host (`.sizer`) and the
    // public root: it keeps the forwarded `ref` and the consumer `className`, so
    // the outermost element a consumer measures / styles is unchanged from before
    // the wrapper existed. The INNER `.container` is a DESCENDANT of the host, so
    // the `@container chat-input` rules (which target `.container` + `.sendButton`)
    // match without a self-rule no-op.
    <div ref={ref} className={`${styles.sizer} ${className}`} style={style} {...rest}>
      <div className={styles.container}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className={styles.textarea}
            rows={1}
            aria-label="Chat message input"
          />
        </div>
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
          loading={isLoading}
          className={styles.sendButton}
          aria-label="Send message"
        >
          Send
        </Button>
      </div>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'
