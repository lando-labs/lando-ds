/**
 * AvatarGroup Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from '../Avatar'
import { AvatarGroup } from './AvatarGroup'

describe('AvatarGroup', () => {
  it('renders all children when no max is set', () => {
    render(
      <AvatarGroup>
        <Avatar initials="JD" alt="JD" />
        <Avatar initials="AB" alt="AB" />
        <Avatar initials="CD" alt="CD" />
      </AvatarGroup>,
    )
    expect(screen.getByLabelText('JD')).toBeInTheDocument()
    expect(screen.getByLabelText('AB')).toBeInTheDocument()
    expect(screen.getByLabelText('CD')).toBeInTheDocument()
  })

  it('truncates beyond max and renders a +N overflow affordance', () => {
    render(
      <AvatarGroup max={2}>
        <Avatar initials="JD" alt="JD" />
        <Avatar initials="AB" alt="AB" />
        <Avatar initials="CD" alt="CD" />
        <Avatar initials="EF" alt="EF" />
      </AvatarGroup>,
    )
    // First two render; the last two collapse into "+2".
    expect(screen.getByLabelText('JD')).toBeInTheDocument()
    expect(screen.getByLabelText('AB')).toBeInTheDocument()
    expect(screen.queryByLabelText('CD')).not.toBeInTheDocument()
    expect(screen.getByLabelText('2 more')).toHaveTextContent('+2')
  })

  it('does not render an overflow chip when count <= max', () => {
    render(
      <AvatarGroup max={5}>
        <Avatar initials="JD" alt="JD" />
        <Avatar initials="AB" alt="AB" />
      </AvatarGroup>,
    )
    expect(screen.queryByLabelText(/more/)).not.toBeInTheDocument()
  })

  it('propagates `size` via the data-size hint', () => {
    render(
      <AvatarGroup size="lg" data-testid="g">
        <Avatar initials="JD" alt="JD" />
      </AvatarGroup>,
    )
    expect(screen.getByTestId('g')).toHaveAttribute('data-size', 'lg')
  })
})
