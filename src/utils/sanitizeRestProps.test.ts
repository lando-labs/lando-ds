import { describe, it, expect } from 'vitest'
import { sanitizeRestProps } from './sanitizeRestProps'

describe('sanitizeRestProps (#320)', () => {
  it('strips dangerouslySetInnerHTML', () => {
    const out = sanitizeRestProps({ dangerouslySetInnerHTML: { __html: '<img>' }, id: 'x' })
    expect('dangerouslySetInnerHTML' in out).toBe(false)
    expect(out.id).toBe('x')
  })

  it('strips STRING-valued on* handlers (injection signal)', () => {
    const out = sanitizeRestProps({ onClick: 'alert(1)', onMouseOver: 'evil()' })
    expect('onClick' in out).toBe(false)
    expect('onMouseOver' in out).toBe(false)
  })

  it('KEEPS function event handlers (legitimate React props)', () => {
    const fn = () => {}
    const out = sanitizeRestProps({ onClick: fn })
    expect(out.onClick).toBe(fn)
  })

  it('keeps benign pass-through props (data-*, aria-*, title, style)', () => {
    const style = { color: 'red' }
    const out = sanitizeRestProps({
      'data-testid': 't',
      'aria-label': 'l',
      title: 'hi',
      style,
    })
    expect(out['data-testid']).toBe('t')
    expect(out['aria-label']).toBe('l')
    expect(out.title).toBe('hi')
    expect(out.style).toBe(style)
  })

  it('returns an empty object for empty input', () => {
    expect(sanitizeRestProps({})).toEqual({})
  })
})
