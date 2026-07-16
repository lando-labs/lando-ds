/**
 * StepProgress Component Tests
 *
 * Covers:
 * - Both API overloads (status objects vs currentStep + string[])
 * - All three variants (dots, labeled, numbered)
 * - Both orientations (horizontal, vertical)
 * - Visual state mapping (completed/active/upcoming/error)
 * - 3 / 5 / 8 step layouts
 * - aria-current="step" on the active step
 * - role="list" + aria-label on the root
 * - jest-axe smoke tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { StepProgress } from './StepProgress'
import type { StepProgressStep } from './StepProgress'

expect.extend(toHaveNoViolations)

describe('StepProgress', () => {
  describe('API overloads', () => {
    it('renders the per-step status overload', () => {
      const steps: StepProgressStep[] = [
        { label: 'Analyzing', status: 'completed' },
        { label: 'Generating', status: 'active' },
        { label: 'Synthesizing', status: 'upcoming' },
      ]
      render(<StepProgress steps={steps} variant="labeled" />)
      expect(screen.getByText('Analyzing')).toBeInTheDocument()
      expect(screen.getByText('Generating')).toBeInTheDocument()
      expect(screen.getByText('Synthesizing')).toBeInTheDocument()
    })

    it('renders the currentStep + string[] overload, computing statuses', () => {
      const { container } = render(
        <StepProgress
          steps={['One', 'Two', 'Three', 'Four']}
          currentStep={2}
          variant="labeled"
        />
      )
      const items = container.querySelectorAll('li')
      expect(items).toHaveLength(4)
      expect(items[0]?.getAttribute('data-status')).toBe('completed')
      expect(items[1]?.getAttribute('data-status')).toBe('completed')
      expect(items[2]?.getAttribute('data-status')).toBe('active')
      expect(items[3]?.getAttribute('data-status')).toBe('upcoming')
    })

    it('treats currentStep=0 as the first step active', () => {
      const { container } = render(
        <StepProgress steps={['A', 'B', 'C']} currentStep={0} />
      )
      const items = container.querySelectorAll('li')
      expect(items[0]?.getAttribute('data-status')).toBe('active')
      expect(items[1]?.getAttribute('data-status')).toBe('upcoming')
      expect(items[2]?.getAttribute('data-status')).toBe('upcoming')
    })

    it('handles currentStep beyond bounds → all completed', () => {
      const { container } = render(
        <StepProgress steps={['A', 'B', 'C']} currentStep={99} />
      )
      const items = container.querySelectorAll('li')
      items.forEach((it) => {
        expect(it.getAttribute('data-status')).toBe('completed')
      })
    })
  })

  describe('orientation', () => {
    it('renders horizontal orientation by default', () => {
      const { container } = render(
        <StepProgress steps={[{ label: 'A' }, { label: 'B' }]} />
      )
      expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument()
    })

    it('renders vertical orientation when requested', () => {
      const { container } = render(
        <StepProgress
          steps={[{ label: 'A' }, { label: 'B' }]}
          orientation="vertical"
        />
      )
      expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders variant="dots" without visible labels', () => {
      const { container } = render(
        <StepProgress
          steps={[{ label: 'Hidden Label' }]}
          variant="dots"
        />
      )
      expect(container.querySelector('[data-variant="dots"]')).toBeInTheDocument()
      // Label is sr-only, but still in the DOM for screen readers.
      expect(screen.getByText('Hidden Label')).toBeInTheDocument()
    })

    it('renders variant="labeled" with visible labels', () => {
      const { container } = render(
        <StepProgress
          steps={[{ label: 'Visible Label' }]}
          variant="labeled"
        />
      )
      expect(container.querySelector('[data-variant="labeled"]')).toBeInTheDocument()
      expect(screen.getByText('Visible Label')).toBeInTheDocument()
    })

    it('renders variant="numbered" with step numbers (1, 2, 3)', () => {
      render(
        <StepProgress
          steps={[
            { label: 'A', status: 'upcoming' },
            { label: 'B', status: 'upcoming' },
            { label: 'C', status: 'upcoming' },
          ]}
          variant="numbered"
        />
      )
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('numbered variant renders a checkmark for completed steps', () => {
      const { container } = render(
        <StepProgress
          steps={[
            { label: 'Done', status: 'completed' },
            { label: 'Now', status: 'active' },
          ]}
          variant="numbered"
        />
      )
      // First step completed → no "1" digit, instead an SVG check.
      expect(screen.queryByText('1')).toBeNull()
      // Second step active → still shows the "2" digit.
      expect(screen.getByText('2')).toBeInTheDocument()
      // SVG is rendered inside the marker for the completed step.
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('visual state mapping', () => {
    it('renders all four statuses with matching data-status', () => {
      const { container } = render(
        <StepProgress
          steps={[
            { label: 'Done', status: 'completed' },
            { label: 'Doing', status: 'active' },
            { label: 'Failed', status: 'error' },
            { label: 'Waiting', status: 'upcoming' },
          ]}
          variant="labeled"
        />
      )
      const items = container.querySelectorAll('li')
      expect(items[0]?.getAttribute('data-status')).toBe('completed')
      expect(items[1]?.getAttribute('data-status')).toBe('active')
      expect(items[2]?.getAttribute('data-status')).toBe('error')
      expect(items[3]?.getAttribute('data-status')).toBe('upcoming')
    })

    it('error status renders distinctive marker + connector state', () => {
      const { container } = render(
        <StepProgress
          steps={[
            { label: 'Failed', status: 'error' },
            { label: 'Next', status: 'upcoming' },
          ]}
          variant="dots"
        />
      )
      const errorMarker = container.querySelector('[data-status="error"]')
      expect(errorMarker).toBeInTheDocument()
      const connector = container.querySelector('[data-state="error"]')
      expect(connector).toBeInTheDocument()
    })

    it('connector between two completed steps is filled', () => {
      const { container } = render(
        <StepProgress
          steps={['A', 'B', 'C']}
          currentStep={2}
        />
      )
      const filledConnectors = container.querySelectorAll('[data-state="filled"]')
      // Steps 0 and 1 are completed → both their connectors are "filled".
      expect(filledConnectors.length).toBeGreaterThanOrEqual(2)
    })

    it('does not render a connector after the last step', () => {
      const { container } = render(
        <StepProgress steps={[{ label: 'Solo' }]} variant="dots" />
      )
      // One step → zero connectors.
      const connectors = container.querySelectorAll('[data-state]')
      expect(connectors).toHaveLength(0)
    })
  })

  describe('layouts', () => {
    it('renders 3-step layout', () => {
      const { container } = render(
        <StepProgress steps={['A', 'B', 'C']} currentStep={1} />
      )
      expect(container.querySelectorAll('li')).toHaveLength(3)
    })

    it('renders 5-step layout', () => {
      const { container } = render(
        <StepProgress
          steps={['A', 'B', 'C', 'D', 'E']}
          currentStep={2}
        />
      )
      expect(container.querySelectorAll('li')).toHaveLength(5)
    })

    it('renders 8-step layout (newsroom editorial flow)', () => {
      const { container } = render(
        <StepProgress
          steps={[
            'draft',
            'editor_review',
            'revision',
            'second_review',
            'human_review',
            'approved',
            'published',
            'killed',
          ]}
          currentStep={4}
          variant="labeled"
        />
      )
      expect(container.querySelectorAll('li')).toHaveLength(8)
      const items = container.querySelectorAll('li')
      // First four completed, fifth active, rest upcoming.
      expect(items[0]?.getAttribute('data-status')).toBe('completed')
      expect(items[3]?.getAttribute('data-status')).toBe('completed')
      expect(items[4]?.getAttribute('data-status')).toBe('active')
      expect(items[7]?.getAttribute('data-status')).toBe('upcoming')
    })
  })

  describe('accessibility', () => {
    it('root has role="list" with default aria-label="Progress"', () => {
      render(<StepProgress steps={[{ label: 'A' }]} />)
      const list = screen.getByRole('list')
      expect(list).toHaveAttribute('aria-label', 'Progress')
    })

    it('respects custom aria-label', () => {
      render(
        <StepProgress
          steps={[{ label: 'A' }]}
          aria-label="Onboarding progress"
        />
      )
      expect(screen.getByRole('list')).toHaveAttribute(
        'aria-label',
        'Onboarding progress'
      )
    })

    it('active step has aria-current="step"', () => {
      const { container } = render(
        <StepProgress steps={['A', 'B', 'C']} currentStep={1} />
      )
      const currentSteps = container.querySelectorAll('[aria-current="step"]')
      expect(currentSteps).toHaveLength(1)
    })

    it('non-active steps do not carry aria-current', () => {
      const { container } = render(
        <StepProgress steps={['A', 'B', 'C']} currentStep={1} />
      )
      const items = container.querySelectorAll('li')
      expect(items[0]?.getAttribute('aria-current')).toBeNull()
      expect(items[1]?.getAttribute('aria-current')).toBe('step')
      expect(items[2]?.getAttribute('aria-current')).toBeNull()
    })

    it('has no a11y violations — horizontal labeled', async () => {
      const { container } = render(
        <StepProgress
          steps={['Sign up', 'Add interests', 'Choose blends', 'Done']}
          currentStep={2}
          variant="labeled"
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no a11y violations — vertical numbered', async () => {
      const { container } = render(
        <StepProgress
          steps={[
            { label: 'Done', status: 'completed' },
            { label: 'Now', status: 'active' },
            { label: 'Later', status: 'upcoming' },
          ]}
          orientation="vertical"
          variant="numbered"
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no a11y violations — error state', async () => {
      const { container } = render(
        <StepProgress
          steps={[
            { label: 'Done', status: 'completed' },
            { label: 'Failed', status: 'error' },
            { label: 'Skipped', status: 'upcoming' },
          ]}
          variant="labeled"
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('forwardRef', () => {
    it('forwards a ref to the root <ol> element', () => {
      const ref = { current: null as HTMLOListElement | null }
      render(
        <StepProgress
          ref={ref}
          steps={[{ label: 'A' }, { label: 'B' }]}
        />
      )
      expect(ref.current).toBeInstanceOf(HTMLOListElement)
    })
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual root (<ol>), and the internal role="list" is NOT clobbered
  // by a consumer-supplied `role`.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the root <ol>', () => {
      render(
        <StepProgress
          steps={[{ label: 'A' }, { label: 'B' }]}
          data-testid="my-stepprogress"
          style={{ color: 'rgb(40, 50, 60)' }}
        />
      )
      const root = screen.getByTestId('my-stepprogress')
      expect(root.tagName).toBe('OL')
      expect(root.style.color).toBe('rgb(40, 50, 60)')
    })

    it('keeps the internal list role even when the consumer passes role', () => {
      render(
        <StepProgress
          steps={[{ label: 'A' }, { label: 'B' }]}
          data-testid="roled-stepprogress"
          role="presentation"
        />
      )
      expect(screen.getByTestId('roled-stepprogress')).toHaveAttribute(
        'role',
        'list'
      )
    })

    it('does not leak steps / currentStep onto the DOM', () => {
      render(
        <StepProgress
          steps={['One', 'Two', 'Three']}
          currentStep={1}
          data-testid="clean-stepprogress"
        />
      )
      const root = screen.getByTestId('clean-stepprogress')
      expect(root).not.toHaveAttribute('steps')
      expect(root).not.toHaveAttribute('currentstep')
    })
  })
})
