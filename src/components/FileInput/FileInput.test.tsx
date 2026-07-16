/**
 * FileInput Component Tests
 *
 * Sprint 55 (#316) — Lane E of v0.34.0. Covers drop, paste, native picker,
 * validation (accept / maxSize / maxFiles), controlled vs uncontrolled,
 * remove, disabled, and a11y/axe.
 *
 * jsdom note: DataTransfer and ClipboardData are not implemented natively
 * in jsdom. We hand `dataTransfer` / `clipboardData` plain-object stubs
 * to fireEvent.<name>() — Testing Library forwards them onto the
 * SyntheticEvent so React's onDrop/onDragOver/onPaste handlers receive
 * a value that quacks like the real thing for our purposes (.files,
 * .items, .types). Going through fireEvent.* (vs raw dispatchEvent)
 * also wraps the dispatch in act() so React state updates settle.
 */

import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { FileInput, type FileRejection } from './FileInput'

/* -------------------------------------------------------------------------- *
 *  Helpers — jsdom DataTransfer / ClipboardData shims
 * -------------------------------------------------------------------------- */

function makeFile(
  name: string,
  size = 100,
  type = 'text/plain'
): File {
  // Build a Blob with a string sized to `size` bytes so File.size is
  // deterministic in jsdom.
  const content = 'a'.repeat(size)
  return new File([content], name, { type })
}

function dataTransferStub(files: File[]) {
  return {
    files,
    items: files.map((f) => ({
      kind: 'file',
      type: f.type,
      getAsFile: () => f,
    })),
    types: ['Files'],
    dropEffect: 'copy' as const,
    effectAllowed: 'copyMove' as const,
  }
}

function fireDrop(target: Element, files: File[]) {
  fireEvent.drop(target, { dataTransfer: dataTransferStub(files) })
}

function fireDragOver(target: Element) {
  fireEvent.dragOver(target, { dataTransfer: dataTransferStub([]) })
}

function fireDragEnter(target: Element) {
  fireEvent.dragEnter(target, { dataTransfer: dataTransferStub([]) })
}

function firePaste(target: Element, files: File[]) {
  fireEvent.paste(target, {
    clipboardData: {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: f.type,
        getAsFile: () => f,
      })),
      types: ['Files'],
    },
  })
}

function getZone() {
  return screen.getByRole('button', { name: /browse files or drop here/i })
}

/* -------------------------------------------------------------------------- *
 *  Tests
 * -------------------------------------------------------------------------- */

// noUncheckedIndexedAccess note: every non-null assertion (!) below is safe.
// Each `onChange`/`onReject` mock call is triggered by the test's own
// drop/paste/click before its `.mock.calls` entry is read (usually asserted via
// toHaveBeenCalledTimes), and each `rejections` access follows a drop that
// produces exactly that rejection (length-asserted where applicable).
describe('FileInput', () => {
  /* ---------- Rendering ---------- */

  it('renders a dropzone with role=button and accessible name', () => {
    render(<FileInput label="Attachments" />)
    expect(
      screen.getByRole('button', { name: /browse files or drop here/i })
    ).toBeInTheDocument()
    expect(screen.getByText('Attachments')).toBeInTheDocument()
  })

  it('renders nothing in the file list when selection is empty', () => {
    render(<FileInput />)
    // Empty list = no <li> elements at all
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  /* ---------- Native picker click ---------- */

  it('clicking the dropzone triggers the hidden file picker', () => {
    const { container } = render(<FileInput />)
    const hiddenInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(hiddenInput, 'click')

    fireEvent.click(getZone())

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('Browse-files button triggers the picker as a separate affordance', () => {
    const { container } = render(<FileInput />)
    const hiddenInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(hiddenInput, 'click')

    // Use { name: 'Browse files', exact: true } to avoid matching the
    // zone's "Browse files or drop here" aria-label.
    fireEvent.click(
      screen.getByRole('button', { name: 'Browse files' })
    )

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  /* ---------- Drag-over visual highlight ---------- */

  it('drag-over adds the drag-over data attribute to the zone', () => {
    render(<FileInput />)
    const zone = getZone()
    expect(zone).not.toHaveAttribute('data-drag-over')

    fireDragEnter(zone)
    fireDragOver(zone)

    expect(zone).toHaveAttribute('data-drag-over', 'true')
  })

  /* ---------- Drop adds files ---------- */

  it('drop adds files to the selection and fires onChange', () => {
    const onChange = vi.fn()
    render(<FileInput multiple onChange={onChange} />)
    const zone = getZone()

    const files = [makeFile('a.txt'), makeFile('b.txt')]
    fireDrop(zone, files)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0]).toHaveLength(2)
    expect(onChange.mock.calls[0]![0][0].name).toBe('a.txt')
    expect(screen.getByText('a.txt')).toBeInTheDocument()
    expect(screen.getByText('b.txt')).toBeInTheDocument()
  })

  /* ---------- accept filter on drop ---------- */

  it('accept filter rejects mime types not in the allow-list on drop', () => {
    const onChange = vi.fn()
    const onReject = vi.fn()
    render(
      <FileInput
        accept="image/*"
        multiple
        onChange={onChange}
        onReject={onReject}
      />
    )
    const zone = getZone()

    const txt = makeFile('notes.txt', 50, 'text/plain')
    const png = makeFile('pic.png', 50, 'image/png')
    fireDrop(zone, [txt, png])

    // Only the image accepted
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].map((f: File) => f.name)).toEqual([
      'pic.png',
    ])

    // The text file surfaced as a rejection
    expect(onReject).toHaveBeenCalledTimes(1)
    const rejections: FileRejection[] = onReject.mock.calls[0]![0]
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.reason).toBe('accept')
    expect(rejections[0]!.file.name).toBe('notes.txt')
  })

  /* ---------- maxSize ---------- */

  it('maxSize rejects oversized files and surfaces an error message', () => {
    const onReject = vi.fn()
    render(<FileInput maxSize={100} multiple onReject={onReject} />)
    const zone = getZone()

    const ok = makeFile('small.txt', 50)
    const tooBig = makeFile('huge.txt', 500)
    fireDrop(zone, [ok, tooBig])

    // Error region appears (role=alert)
    expect(screen.getByRole('alert')).toHaveTextContent(/huge\.txt/)
    expect(screen.getByRole('alert')).toHaveTextContent(/size limit/i)

    const rejections: FileRejection[] = onReject.mock.calls[0]![0]
    expect(rejections[0]!.reason).toBe('max-size')
  })

  /* ---------- maxFiles ---------- */

  it('maxFiles rejects files beyond the cap', () => {
    const onChange = vi.fn()
    const onReject = vi.fn()
    render(
      <FileInput
        multiple
        maxFiles={2}
        onChange={onChange}
        onReject={onReject}
      />
    )
    const zone = getZone()

    const files = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]
    fireDrop(zone, files)

    // Only 2 accepted (the cap)
    expect(onChange.mock.calls[0]![0]).toHaveLength(2)
    // c.txt was the overflow
    const rejections: FileRejection[] = onReject.mock.calls[0]![0]
    expect(rejections.some((r) => r.reason === 'max-files')).toBe(true)
    expect(rejections.some((r) => r.file.name === 'c.txt')).toBe(true)
  })

  /* ---------- multiple=false → replace ---------- */

  it('multiple=false replaces the selection on each new drop', () => {
    const onChange = vi.fn()
    render(<FileInput onChange={onChange} />)
    const zone = getZone()

    fireDrop(zone, [makeFile('one.txt')])
    expect(onChange.mock.calls[0]![0].map((f: File) => f.name)).toEqual([
      'one.txt',
    ])

    fireDrop(zone, [makeFile('two.txt')])
    // Should REPLACE, not append
    expect(onChange.mock.calls[1]![0]).toHaveLength(1)
    expect(onChange.mock.calls[1]![0][0].name).toBe('two.txt')
  })

  /* ---------- Paste support ---------- */

  it('paste handler adds files from clipboard data', () => {
    const onChange = vi.fn()
    render(<FileInput multiple onChange={onChange} />)
    const zone = getZone()

    firePaste(zone, [makeFile('clip.png', 50, 'image/png')])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0][0].name).toBe('clip.png')
  })

  /* ---------- Remove a file ---------- */

  it('remove button removes the file from the selection', () => {
    const onChange = vi.fn()
    render(<FileInput multiple onChange={onChange} />)
    const zone = getZone()
    fireDrop(zone, [makeFile('a.txt'), makeFile('b.txt')])

    const removeBtn = screen.getByRole('button', { name: 'Remove a.txt' })
    fireEvent.click(removeBtn)

    // Last onChange should reflect the filtered list
    // safe: onChange fired ≥1× (files were dropped then one removed)
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]![0]
    expect(last.map((f: File) => f.name)).toEqual(['b.txt'])
    // a.txt removed from the rendered list
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument()
  })

  /* ---------- Controlled vs uncontrolled ---------- */

  it('controlled mode: passing `files` and never calling internal setter still reflects renders', () => {
    // External state -- the consumer owns it.
    const Controlled = () => {
      const [files, setFiles] = useState<File[]>([makeFile('initial.txt')])
      return (
        <>
          <FileInput files={files} onChange={setFiles} multiple />
          <button type="button" onClick={() => setFiles([])}>
            external clear
          </button>
        </>
      )
    }
    render(<Controlled />)
    expect(screen.getByText('initial.txt')).toBeInTheDocument()

    // External mutation should be reflected (controlled = consumer wins).
    fireEvent.click(screen.getByText('external clear'))
    expect(screen.queryByText('initial.txt')).not.toBeInTheDocument()
  })

  it('uncontrolled mode: defaultFiles seeds the selection without onChange', () => {
    render(
      <FileInput
        defaultFiles={[makeFile('seed.txt')]}
        multiple
      />
    )
    expect(screen.getByText('seed.txt')).toBeInTheDocument()
  })

  /* ---------- Disabled ---------- */

  it('disabled state blocks drop, paste, and picker click', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileInput multiple disabled onChange={onChange} />
    )
    const zone = getZone()
    const hiddenInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(hiddenInput, 'click')

    // Drop: ignored
    fireDrop(zone, [makeFile('x.txt')])
    // Paste: ignored
    firePaste(zone, [makeFile('y.txt')])
    // Click: ignored (hidden input never invoked)
    fireEvent.click(zone)

    expect(onChange).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
    expect(zone).toHaveAttribute('aria-disabled', 'true')
    expect(zone).toHaveAttribute('tabIndex', '-1')
  })

  /* ---------- A11y: aria-invalid wires up with error ---------- */

  it('error prop wires aria-invalid and surfaces as role=alert', () => {
    render(<FileInput error="Upload failed" />)
    const zone = getZone()
    expect(zone).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed')
  })

  /* ---------- Custom renderFile slot ---------- */

  it('renderFile slot replaces the default per-file row', () => {
    render(
      <FileInput
        multiple
        defaultFiles={[makeFile('custom.png', 50, 'image/png')]}
        renderFile={(f, remove) => (
          <div data-testid="custom-row">
            CUSTOM:{f.name}
            <button type="button" onClick={remove}>
              X
            </button>
          </div>
        )}
      />
    )
    expect(screen.getByTestId('custom-row')).toHaveTextContent(
      'CUSTOM:custom.png'
    )
  })

  /* ---------- Axe ---------- */

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <FileInput
        label="Attachments"
        helperText="PDF or images, under 5 MB"
        accept=".pdf,image/*"
        multiple
        maxSize={5 * 1024 * 1024}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
