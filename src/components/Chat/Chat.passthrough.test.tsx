/**
 * Chat subcomponent consumer-passthrough tests (#422, Lane C).
 *
 * Asserts the "no silent override" contract for ChatMessage, ChatInput, and
 * ChatThinkingIndicator: a consumer `data-testid` lands on the visual root,
 * and a consumer `style` wins on that same root. Each subcomponent's visual
 * root is the OUTERMOST element it renders (the `.sizer` container-query host
 * for ChatMessage / ChatInput; the `.indicator` row for ChatThinkingIndicator).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chat } from './Chat'
import { ChatMessage, type Message } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatThinkingIndicator } from './ChatThinkingIndicator'

// jsdom does not implement Element.prototype.scrollIntoView, which the parent
// Chat calls in a mount effect (auto-scroll to latest message). Stub it so the
// full Chat container can render under test. Unrelated to the #423 contract.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
})

const userMessage: Message = {
  id: '1',
  type: 'user',
  content: 'Hello there',
  timestamp: new Date('2026-01-01T12:00:00'),
}

const systemMessage: Message = {
  id: '2',
  type: 'system',
  content: 'System notice',
  timestamp: new Date('2026-01-01T12:00:00'),
}

describe('ChatMessage — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the outer visual root (user message)', () => {
    render(
      <ChatMessage message={userMessage} data-testid="chat-msg" />,
    )
    const el = screen.getByTestId('chat-msg')
    expect(el.tagName).toBe('DIV')
    // root is outermost — the message text lives inside it
    expect(el).toContainElement(screen.getByText('Hello there'))
  })

  it('applies consumer style to the visual root (user message)', () => {
    render(
      <ChatMessage
        message={userMessage}
        data-testid="chat-msg"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('chat-msg')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('applies consumer data-testid + style to the visual root (system message)', () => {
    render(
      <ChatMessage
        message={systemMessage}
        data-testid="chat-sys"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    const el = screen.getByTestId('chat-sys')
    expect(el.tagName).toBe('DIV')
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})

describe('ChatInput — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the outer visual root', () => {
    render(<ChatInput onSend={vi.fn()} data-testid="chat-input" />)
    const el = screen.getByTestId('chat-input')
    expect(el.tagName).toBe('DIV')
    // textarea is a descendant of the root
    expect(el).toContainElement(
      screen.getByRole('textbox', { name: /chat message input/i }),
    )
  })

  it('applies consumer style to the visual root', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        data-testid="chat-input"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('chat-input')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })
})

describe('ChatThinkingIndicator — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the visual root', () => {
    render(<ChatThinkingIndicator state="thinking" data-testid="chat-think" />)
    const el = screen.getByTestId('chat-think')
    expect(el.tagName).toBe('DIV')
  })

  it('applies consumer style to the visual root', () => {
    render(
      <ChatThinkingIndicator
        state="thinking"
        data-testid="chat-think"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('chat-think')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })

  it('keeps the internal role="status" (internals win over consumer rest)', () => {
    render(
      <ChatThinkingIndicator
        state="researching"
        data-testid="chat-think"
        role="presentation"
      />,
    )
    // The component sets role="status" AFTER spreading rest, so the internal
    // ARIA role is preserved even when a consumer passes a conflicting role.
    expect(screen.getByTestId('chat-think')).toHaveAttribute('role', 'status')
  })
})

// Parent Chat container (#423). Its subcomponents were covered above in
// Sprint 58; here we assert the parent Chat's own passthrough contract.
// The visual root is the OUTERMOST element it renders (the `.sizer`
// container-query host that keeps the forwarded ref + consumer className).
describe('Chat — consumer passthrough (#423)', () => {
  const messages: Message[] = [userMessage]

  it('lands consumer data-testid on the outer visual root', () => {
    render(
      <Chat
        messages={messages}
        onSendMessage={vi.fn()}
        data-testid="chat-root"
      />,
    )
    const el = screen.getByTestId('chat-root')
    expect(el.tagName).toBe('DIV')
    // the message list (and its text) live inside the root
    expect(el).toContainElement(screen.getByText('Hello there'))
  })

  it('applies consumer style to the visual root', () => {
    render(
      <Chat
        messages={messages}
        onSendMessage={vi.fn()}
        data-testid="chat-root"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('chat-root')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})
