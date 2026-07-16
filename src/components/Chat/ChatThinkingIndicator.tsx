import React from 'react'
import styles from './ChatThinkingIndicator.module.css'

export interface ChatThinkingIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Current AI processing state */
  state: 'thinking' | 'researching' | 'writing'
  /** Additional CSS class */
  className?: string
}

const stateLabels = {
  thinking: 'Thinking...',
  researching: 'Researching...',
  writing: 'Writing...'
}

/**
 * ChatThinkingIndicator
 *
 * Shows AI processing state with a wave dots animation.
 * Used to provide visual feedback when AI is processing a response.
 */
export const ChatThinkingIndicator = React.forwardRef<HTMLDivElement, ChatThinkingIndicatorProps>((
  { state, className = '', style, ...rest },
  ref
) => {
  return (
    <div
      ref={ref}
      className={`${styles.indicator} ${className}`}
      style={style}
      {...rest}
      role="status"
      aria-live="polite"
    >
      <div className={styles.dots} aria-hidden="true">
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
      </div>
      <span className={styles.label}>{stateLabels[state]}</span>
    </div>
  )
})

ChatThinkingIndicator.displayName = 'ChatThinkingIndicator'
