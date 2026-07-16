import React from 'react'
import { Avatar } from '../Avatar'
import { Markdown } from '../Markdown'
import styles from './ChatMessage.module.css'

export interface Message {
  /** Unique message identifier */
  id: string
  /** Message type determines styling and alignment */
  type: 'user' | 'ai' | 'system'
  /** Message content (supports markdown for AI messages) */
  content: string | React.ReactNode
  /** Message timestamp */
  timestamp: Date
  /** Optional avatar URL */
  avatar?: string
  /** Enable markdown rendering for this message (default: true for AI messages) */
  enableMarkdown?: boolean
}

export interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Message data */
  message: Message
  /** Additional CSS class */
  className?: string
}

/**
 * ChatMessage
 *
 * Displays a single message with avatar, content, and timestamp.
 * Styling varies based on message type (user, ai, system).
 */
export const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>((
  { message, className = '', style, ...rest },
  ref
) => {
  const { type, content, timestamp, avatar, enableMarkdown } = message

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  }

  // Check if content should be rendered as markdown
  const shouldRenderMarkdown = enableMarkdown !== false && type === 'ai' && typeof content === 'string'

  // Check if content is markdown (has markdown syntax)
  const hasMarkdownSyntax = (text: string): boolean => {
    return /[#*`[\]_-]|^>\s/m.test(text)
  }

  const renderContent = () => {
    // If content is a React node, render it directly
    if (React.isValidElement(content)) {
      return content
    }

    const textContent = content as string

    // Render markdown for AI messages with markdown syntax
    if (shouldRenderMarkdown && hasMarkdownSyntax(textContent)) {
      return <Markdown content={textContent} />
    }

    // Plain text rendering
    return <p className={styles.content}>{textContent}</p>
  }

  // #270 — `.sizer` is the zero-box container-query host (see
  // ChatMessage.module.css). The consumer's `className` and the forwarded `ref`
  // ride the OUTERMOST element (the wrapper) so layout overrides + refs keep
  // targeting the component's outer box, while the `@container` rules can match
  // the `.message` row inside it. The visible message row (`.message` + its
  // type modifier) is unchanged.
  const sizerClasses = [styles.sizer, className].filter(Boolean).join(' ')

  // System messages have different layout
  if (type === 'system') {
    return (
      <div ref={ref} className={sizerClasses} style={style} {...rest}>
        <div className={`${styles.message} ${styles.system}`}>
          <div className={styles.systemContent}>
            <span className={styles.content}>{typeof content === 'string' ? content : content}</span>
            <span className={styles.timestamp}>{formatTime(timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  // User and AI messages
  return (
    <div ref={ref} className={sizerClasses} style={style} {...rest}>
      <div className={`${styles.message} ${styles[type]}`}>
        <div className={styles.avatarWrapper}>
          <Avatar
            size="sm"
            src={avatar}
            initials={type === 'user' ? 'U' : 'AI'}
            gradient={type === 'ai'}
          />
        </div>
        <div className={styles.messageContent}>
          <div className={styles.bubble}>
            {renderContent()}
          </div>
          <span className={styles.timestamp}>{formatTime(timestamp)}</span>
        </div>
      </div>
    </div>
  )
})

ChatMessage.displayName = 'ChatMessage'
