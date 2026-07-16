/**
 * Toast / ToastContainer Tests
 *
 * Covers:
 * - Toast: message, variants, onDismiss (with 300ms exit animation)
 * - ToastContainer: renders toasts prop, positions correctly, maxToasts cap
 * - Auto-dismiss timer behavior (uses vi.useFakeTimers)
 * - duration=0 disables auto-dismiss
 *
 * Note: `useToast` (the canonical provider-backed hook shipped in v0.10.0)
 * is exercised in `ToastProvider.test.tsx`. The legacy queue-style hook
 * was replaced as part of Sprint 16 (#88).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toast } from './Toast'
import { ToastContainer } from './ToastContainer'

describe('Toast', () => {
  describe('component', () => {
    it('renders message', () => {
      render(
        <Toast id="t-1" message="Saved successfully" onDismiss={() => {}} />
      )
      expect(screen.getByText('Saved successfully')).toBeInTheDocument()
    })

    it('renders description (canonical body field, #332)', () => {
      render(
        <Toast id="t-1" description="Saved successfully" onDismiss={() => {}} />
      )
      expect(screen.getByText('Saved successfully')).toBeInTheDocument()
    })

    it('prefers description over message when both are provided (#332)', () => {
      // Silence the expected dev-only "both provided" warning for this case.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(
        <Toast
          id="t-1"
          description="From description"
          message="From message"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('From description')).toBeInTheDocument()
      expect(screen.queryByText('From message')).toBeNull()
      warn.mockRestore()
    })

    it('dev-warns when both description and message are provided (#332)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(
        <Toast
          id="t-1"
          description="Canonical"
          message="Legacy"
          onDismiss={() => {}}
        />
      )
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toMatch(/both `description` and `message`/i) // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
      warn.mockRestore()
    })

    it('dev-warns when neither description nor message is provided (#332)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(<Toast id="t-1" onDismiss={() => {}} />)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toMatch(/no `description` provided/i) // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
      warn.mockRestore()
    })

    it('does not dev-warn for a normal description-only toast (#332)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(<Toast id="t-1" description="All good" onDismiss={() => {}} />)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('renders title when provided', () => {
      render(
        <Toast
          id="t-1"
          title="Success"
          message="Profile updated"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Profile updated')).toBeInTheDocument()
    })

    it('applies role="alert" with aria-live', () => {
      render(<Toast id="t-1" message="Hello" onDismiss={() => {}} />)
      const el = screen.getByRole('alert')
      expect(el).toHaveAttribute('aria-live', 'polite')
    })

    it.each(['success', 'error', 'warning', 'info'] as const)(
      'applies variant class for %s',
      (variant) => {
        render(
          <Toast
            id={`t-${variant}`}
            variant={variant}
            message={`msg ${variant}`}
            onDismiss={() => {}}
          />
        )
        expect(screen.getByRole('alert').className).toMatch(
          new RegExp(variant)
        )
      }
    )

    it('fires onDismiss when close button clicked (after exit animation)', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      render(
        <Toast
          id="t-1"
          message="Dismiss me"
          duration={0}
          onDismiss={onDismiss}
        />
      )
      fireEvent.click(
        screen.getByRole('button', { name: /dismiss notification/i })
      )
      // Exit animation is 300ms
      expect(onDismiss).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith('t-1')
      vi.useRealTimers()
    })

    it('renders action button and calls its handler', () => {
      const actionFn = vi.fn()
      render(
        <Toast
          id="t-1"
          message="Undo?"
          duration={0}
          action={{ label: 'Undo', onClick: actionFn }}
          onDismiss={() => {}}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(actionFn).toHaveBeenCalledTimes(1)
    })

    it('auto-dismisses after duration elapses', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      render(
        <Toast
          id="t-auto"
          message="Auto-dismiss"
          duration={2000}
          onDismiss={onDismiss}
        />
      )
      // Progress bar ticks every 50ms; after the full duration the toast
      // triggers handleDismiss which waits another 300ms before firing.
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onDismiss).toHaveBeenCalledWith('t-auto')
      vi.useRealTimers()
    })

    it('does not auto-dismiss when duration=0', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      render(
        <Toast
          id="t-persist"
          message="Sticky"
          duration={0}
          onDismiss={onDismiss}
        />
      )
      act(() => {
        vi.advanceTimersByTime(60000)
      })
      expect(onDismiss).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('ToastContainer', () => {
    it('renders toasts passed as prop', () => {
      const toasts = [
        {
          id: 't-1',
          message: 'First',
          duration: 0,
          onDismiss: () => {},
        },
        {
          id: 't-2',
          message: 'Second',
          duration: 0,
          onDismiss: () => {},
        },
      ]
      render(<ToastContainer toasts={toasts} />)
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
    })

    it('caps visible toasts to maxToasts', () => {
      const toasts = Array.from({ length: 5 }).map((_, i) => ({
        id: `t-${i}`,
        message: `Toast ${i}`,
        duration: 0,
        onDismiss: () => {},
      }))
      render(<ToastContainer toasts={toasts} maxToasts={2} />)
      expect(screen.getByText('Toast 0')).toBeInTheDocument()
      expect(screen.getByText('Toast 1')).toBeInTheDocument()
      expect(screen.queryByText('Toast 2')).toBeNull()
      expect(screen.queryByText('Toast 3')).toBeNull()
    })

    it('applies position class (portal renders to document.body)', () => {
      const toasts = [
        { id: 't-1', message: 'Top-left', duration: 0, onDismiss: () => {} },
      ]
      const { unmount } = render(
        <ToastContainer toasts={toasts} position="top-left" />
      )
      // Portal renders outside the React root; find by class substring.
      // ToastContainer.tsx strips hyphens: 'top-left' -> 'topleft'
      const containers = document.body.querySelectorAll('[class*="topleft"]')
      expect(containers.length).toBeGreaterThan(0)
      unmount()
    })

    it('renders empty when no toasts provided', () => {
      render(<ToastContainer />)
      // No toasts should be in document
      expect(document.body.querySelectorAll('[role="alert"]').length).toBe(0)
    })
  })

})
