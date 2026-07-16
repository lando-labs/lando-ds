/**
 * Chat Component Types
 * Defines message types and component props for the Chat interface
 */

export interface Message {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  thinking?: boolean
}

export interface ChatProps {
  messages: Message[]
  onSendMessage?: (content: string) => void
  isThinking?: boolean
  placeholder?: string
  disabled?: boolean
  appTooling?: React.ReactNode
  className?: string
  maxHeight?: string
}

export interface ChatMessageProps {
  message: Message
  className?: string
}

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export interface ThinkingIndicatorProps {
  className?: string
}
