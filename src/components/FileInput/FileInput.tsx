'use client'

/**
 * FileInput Component
 *
 * Drag-and-drop file picker with click-to-browse, paste support, and
 * per-file validation. Manages file SELECTION state only — uploading,
 * progress, and networking are the consumer's responsibility (see issue
 * #316: "What this DOES NOT do — Upload logic / progress / network").
 *
 * Sprint 55 (#316) — Lane E of v0.34.0.
 *
 * Supports three input methods:
 *   1. Click the dropzone (or its "Browse files" button) → native file picker
 *   2. Drag files onto the dropzone → drop handler
 *   3. Paste files from clipboard while the dropzone is focused
 *
 * Validation runs on every add (drop, picker, paste) — `accept` is
 * re-validated on drop because dropping bypasses the browser's accept
 * filter. Rejected files surface via internal error state + an optional
 * `onReject` callback so the consumer can render a toast / log / etc.
 *
 * @example
 * // Uncontrolled
 * <FileInput
 *   accept="image/*,.pdf"
 *   multiple
 *   maxSize={5 * 1024 * 1024}
 *   maxFiles={10}
 *   onChange={(files) => console.log(files)}
 * />
 *
 * @example
 * // Controlled
 * const [files, setFiles] = useState<File[]>([])
 * <FileInput
 *   files={files}
 *   onChange={setFiles}
 *   accept="image/*"
 *   multiple
 * />
 *
 * @example
 * // Custom file preview slot (for image thumbnails, progress bars, etc.)
 * <FileInput
 *   accept="image/*"
 *   multiple
 *   renderFile={(file, remove) => (
 *     <ImagePreview src={URL.createObjectURL(file)} onRemove={remove} />
 *   )}
 * />
 */

import React, { useCallback, useId, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Icon } from '../Icon'
import { Button } from '../Button'
import styles from './FileInput.module.css'

/**
 * Reason codes emitted via `onReject` so consumers can produce
 * structured feedback (e.g. variant-aware toasts) rather than only
 * displaying the human-readable string.
 */
export type FileRejectionReason =
  | 'accept'
  | 'max-size'
  | 'max-files'

export interface FileRejection {
  file: File
  reason: FileRejectionReason
  /** Human-readable reason — safe to surface directly in UI. */
  message: string
}

export interface FileInputProps {
  /** Selected files (controlled). When provided, the component is fully controlled. */
  files?: File[]
  /** Initial files (uncontrolled). Ignored when `files` is provided. */
  defaultFiles?: File[]
  /** Called whenever the selection changes (add, remove). */
  onChange?: (files: File[]) => void
  /**
   * Called when one or more files are rejected by validation
   * (accept / maxSize / maxFiles). Receives the full list of
   * rejections from a single add operation.
   */
  onReject?: (rejections: FileRejection[]) => void
  /** accept attribute — mime types or extensions, e.g. "image/*,.pdf". */
  accept?: string
  /** Allow multiple file selection. When false, a new file replaces the prior selection. */
  multiple?: boolean
  /** Max bytes per file. Rejected on add. */
  maxSize?: number
  /** Max number of files total. Excess files on add are rejected. */
  maxFiles?: number
  /** Disabled state — no click, no drop, no paste. */
  disabled?: boolean
  /** Label rendered above the dropzone. */
  label?: string
  /** Helper text below the dropzone. Suppressed when `error` is shown. */
  helperText?: string
  /** Error message — overrides internal validation error display. */
  error?: string
  /** Custom prompt text inside the dropzone. */
  placeholder?: string
  /**
   * Render a custom file preview slot per file. Falls back to a
   * filename + remove button row when omitted.
   */
  renderFile?: (file: File, remove: () => void) => React.ReactNode
  /** Stable id for the dropzone wrapper. */
  id?: string
  /** Extra class on the outer container. */
  className?: string
  /** ARIA label for the dropzone region. Defaults to "Browse files or drop here". */
  ariaLabel?: string
}

/* -------------------------------------------------------------------------- *
 *  Validation helpers
 * -------------------------------------------------------------------------- */

/**
 * Test whether a `File` matches an `accept` attribute string.
 *
 * accept tokens may be:
 *   - extension:    ".pdf", ".png"
 *   - mime literal: "image/png", "application/pdf"
 *   - mime wildcard: "image/*", "video/*"
 *
 * Mirrors the spec's "Selecting files" matching rules. When `accept` is
 * empty or undefined, every file matches.
 */
function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return true

  const fileType = (file.type || '').toLowerCase()
  const fileName = (file.name || '').toLowerCase()

  return tokens.some((token) => {
    if (token.startsWith('.')) {
      // Extension match (case-insensitive).
      return fileName.endsWith(token)
    }
    if (token.endsWith('/*')) {
      // mime-wildcard, e.g. "image/*".
      const prefix = token.slice(0, -1) // "image/"
      return fileType.startsWith(prefix)
    }
    return fileType === token
  })
}

/**
 * Stable identity key for de-duping a file across add operations.
 * Drag-and-drop and the file picker both produce fresh `File` instances,
 * so reference equality alone won't catch duplicates.
 */
function fileKey(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`
}

/**
 * Human-readable byte size for error messages.
 * Keep it small + deterministic; locale formatting is consumer territory.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/* -------------------------------------------------------------------------- *
 *  Component
 * -------------------------------------------------------------------------- */

export const FileInput = React.forwardRef<HTMLDivElement, FileInputProps>(
  (
    {
      files,
      defaultFiles,
      onChange,
      onReject,
      accept,
      multiple = false,
      maxSize,
      maxFiles,
      disabled = false,
      label,
      helperText,
      error,
      placeholder,
      renderFile,
      id,
      className = '',
      ariaLabel,
    },
    ref
  ) => {
    const reactId = useId()
    const wrapperId = id || `file-input-${reactId}`
    const inputId = `${wrapperId}-input`
    const listId = `${wrapperId}-list`
    const helperId = `${wrapperId}-helper`
    const errorId = `${wrapperId}-error`
    const announceId = `${wrapperId}-announce`

    const isControlled = files !== undefined
    const [internalFiles, setInternalFiles] = useState<File[]>(
      defaultFiles ?? []
    )
    // Internal validation error from the LAST add. Cleared on a successful
    // mutation. Suppressed when consumer passes `error` (consumer wins —
    // matches Input's contract).
    const [internalError, setInternalError] = useState<string | null>(null)
    // aria-live announcement payload. Updates whenever files are added/removed.
    const [announce, setAnnounce] = useState<string>('')
    const [isDragOver, setIsDragOver] = useState(false)

    const currentFiles = isControlled ? files! : internalFiles
    const hiddenInputRef = useRef<HTMLInputElement>(null)
    // Drag enter/leave fire on every child element traversal — a counter
    // is the standard fix so the dropzone highlight only clears when the
    // pointer ACTUALLY leaves the dropzone bounds.
    const dragDepthRef = useRef(0)

    const displayError = error ?? internalError

    /**
     * Apply validation + de-dup + replace-or-append rules to a batch of
     * incoming files, then commit via controlled `onChange` or internal state.
     *
     * - `accept`: re-validated here (drop bypasses the browser's accept).
     * - `maxSize`: per-file byte cap.
     * - `maxFiles`: cap on TOTAL files post-add. Excess files at the tail
     *   are rejected with reason `max-files`.
     * - `multiple=false`: the FIRST accepted file replaces the entire prior
     *   selection. (Native <input type=file multiple=false> also replaces.)
     * - Duplicates (same name+size+lastModified) are silently skipped — not
     *   surfaced as rejections since they're a no-op rather than a failure.
     */
    const addFiles = useCallback(
      (incoming: File[]) => {
        if (disabled || incoming.length === 0) return

        const rejections: FileRejection[] = []
        const accepted: File[] = []

        for (const f of incoming) {
          if (!matchesAccept(f, accept)) {
            rejections.push({
              file: f,
              reason: 'accept',
              message: `${f.name} is not an accepted file type`,
            })
            continue
          }
          if (maxSize != null && f.size > maxSize) {
            rejections.push({
              file: f,
              reason: 'max-size',
              message: `${f.name} exceeds the ${formatBytes(maxSize)} size limit`,
            })
            continue
          }
          accepted.push(f)
        }

        // Build the next selection.
        let next: File[]
        if (!multiple) {
          // Replace mode: ignore everything after the first accepted file.
          const [firstAccepted] = accepted
          next = firstAccepted ? [firstAccepted] : currentFiles
          // Any extra accepted files in non-multiple mode are silently dropped —
          // they aren't "rejected" in a user-meaningful sense (the user
          // explicitly chose a single-file widget).
        } else {
          // Append mode + de-dup against existing selection.
          const existing = new Set(currentFiles.map(fileKey))
          const fresh = accepted.filter((f) => !existing.has(fileKey(f)))
          next = [...currentFiles, ...fresh]
        }

        // maxFiles applied LAST so it counts against the assembled list.
        if (maxFiles != null && next.length > maxFiles) {
          const overflow = next.slice(maxFiles)
          for (const f of overflow) {
            rejections.push({
              file: f,
              reason: 'max-files',
              message: `${f.name} exceeds the ${maxFiles}-file limit`,
            })
          }
          next = next.slice(0, maxFiles)
        }

        // Commit if anything changed (avoid spurious onChange on a pure-reject batch).
        const changed =
          next.length !== currentFiles.length ||
          next.some((f, i) => f !== currentFiles[i])
        if (changed) {
          if (!isControlled) setInternalFiles(next)
          onChange?.(next)
          const added = next.length - currentFiles.length
          if (added > 0) {
            setAnnounce(
              `${added} file${added === 1 ? '' : 's'} added. ${next.length} total.`
            )
          }
          setInternalError(null)
        }

        if (rejections.length > 0) {
          setInternalError(rejections[0]!.message) // safe: length > 0 checked above
          onReject?.(rejections)
        }
      },
      [
        accept,
        currentFiles,
        disabled,
        isControlled,
        maxFiles,
        maxSize,
        multiple,
        onChange,
        onReject,
      ]
    )

    const removeFileAt = useCallback(
      (index: number) => {
        if (disabled) return
        const next = currentFiles.filter((_, i) => i !== index)
        if (!isControlled) setInternalFiles(next)
        onChange?.(next)
        setAnnounce(`File removed. ${next.length} remaining.`)
      },
      [currentFiles, disabled, isControlled, onChange]
    )

    /* ---- Native picker ------------------------------------------------- */

    const openPicker = useCallback(() => {
      if (disabled) return
      hiddenInputRef.current?.click()
    }, [disabled])

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files
      if (!list) return
      addFiles(Array.from(list))
      // Reset so picking the same file twice still fires change.
      e.target.value = ''
    }

    /* ---- Drag + drop --------------------------------------------------- */

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return
      // preventDefault is REQUIRED on dragover for drop to fire — without
      // this, the browser treats the dropzone as non-droppable and ignores
      // the subsequent drop event entirely.
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return
      e.preventDefault()
      dragDepthRef.current += 1
      if (!isDragOver) setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return
      e.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return
      e.preventDefault()
      dragDepthRef.current = 0
      setIsDragOver(false)
      const list = e.dataTransfer?.files
      if (!list || list.length === 0) return
      addFiles(Array.from(list))
    }

    /* ---- Paste --------------------------------------------------------- */

    /**
     * Paste handler: pull `File` objects out of `clipboardData`. Both
     * `clipboardData.files` and `clipboardData.items` are checked because
     * different browsers populate one or the other depending on source
     * (Finder copy vs in-browser image vs screenshot tools).
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return
      const data = e.clipboardData
      if (!data) return
      const pasted: File[] = []
      if (data.files && data.files.length > 0) {
        pasted.push(...Array.from(data.files))
      } else if (data.items && data.items.length > 0) {
        for (let i = 0; i < data.items.length; i += 1) {
          const item = data.items[i]
          if (!item) continue
          if (item.kind === 'file') {
            const f = item.getAsFile()
            if (f) pasted.push(f)
          }
        }
      }
      if (pasted.length > 0) {
        e.preventDefault()
        addFiles(pasted)
      }
    }

    /* ---- Keyboard ------------------------------------------------------ */

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        // Space scroll is the default; preventDefault keeps focus stable.
        e.preventDefault()
        openPicker()
      }
    }

    /* ---- Click on dropzone (excluding child interactive elements) ----- */

    const handleZoneClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return
      // If the click landed inside an interactive child (button, link,
      // hidden input), don't double-trigger the picker. The button has
      // its own onClick that already calls openPicker.
      const target = e.target as HTMLElement
      if (target.closest('button, a, input')) return
      openPicker()
    }

    /* ---- Render -------------------------------------------------------- */

    const describedBy =
      [
        displayError ? errorId : null,
        helperText && !displayError ? helperId : null,
        announceId,
      ]
        .filter(Boolean)
        .join(' ') || undefined

    const zoneClasses = [
      styles.zone,
      isDragOver ? styles.dragOver : '',
      displayError ? styles.error : '',
      disabled ? styles.disabled : '',
    ]
      .filter(Boolean)
      .join(' ')

    const promptText =
      placeholder ??
      (multiple ? 'Drag files here or' : 'Drag a file here or')

    return (
      <div
        className={`${styles.container} ${className}`}
        ref={ref}
        id={wrapperId}
      >
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}

        {/*
          The hidden <input type="file"> lives OUTSIDE the dropzone <div> so the
          zone (which carries role="button" per the issue spec) does not nest
          another interactive control — that combination triggers axe's
          "nested-interactive" rule. Same reason the Browse-files <button>
          lives outside the zone, rendered just below it as a visible
          secondary affordance.

          The zone <div> remains the primary keyboard-activatable surface:
          tabIndex=0, role=button, Enter/Space opens the native picker,
          drag-over highlights, drop adds files, paste pulls files from
          clipboardData. Click-anywhere-in-zone also opens the picker.
         */}
        <input
          ref={hiddenInputRef}
          id={inputId}
          type="file"
          className={styles.hiddenInput}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handlePickerChange}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div
          className={zoneClasses}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel || 'Browse files or drop here'}
          aria-disabled={disabled || undefined}
          aria-invalid={displayError ? true : undefined}
          aria-describedby={describedBy}
          onClick={handleZoneClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          data-drag-over={isDragOver || undefined}
        >
          <div className={styles.zoneInner}>
            <span className={styles.zoneIcon} aria-hidden="true">
              <Icon size="lg">
                <Upload />
              </Icon>
            </span>
            <span className={styles.zonePrompt}>
              {isDragOver ? (
                <strong>Drop to add</strong>
              ) : (
                <span>{promptText}</span>
              )}
            </span>
            {(accept || maxSize || maxFiles) && !isDragOver && (
              <span className={styles.zoneMeta}>
                {accept && <span>{accept}</span>}
                {maxSize != null && <span>up to {formatBytes(maxSize)}</span>}
                {maxFiles != null && (
                  <span>
                    max {maxFiles} file{maxFiles === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/*
          Browse-files button lives below the zone to keep the zone free of
          nested interactive controls (a11y). It's still visually associated
          with the prompt inside the zone via proximity + the matching label.
         */}
        {!disabled && (
          <div className={styles.zoneActions}>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={disabled}
              onClick={openPicker}
            >
              Browse files
            </Button>
          </div>
        )}

        {/* aria-live region for add/remove announcements. Kept visually
            hidden but accessible. */}
        <span
          id={announceId}
          className={styles.srOnly}
          aria-live="polite"
          aria-atomic="true"
        >
          {announce}
        </span>

        {currentFiles.length > 0 && (
          <ul id={listId} className={styles.fileList}>
            {currentFiles.map((file, i) => {
              const remove = () => removeFileAt(i)
              return (
                <li
                  key={`${fileKey(file)}-${i}`}
                  className={styles.fileItem}
                >
                  {renderFile ? (
                    renderFile(file, remove)
                  ) : (
                    <>
                      <span className={styles.fileMeta}>
                        <span className={styles.fileName} title={file.name}>
                          {file.name}
                        </span>
                        <span className={styles.fileSize}>
                          {formatBytes(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.fileRemove}
                        onClick={remove}
                        aria-label={`Remove ${file.name}`}
                        disabled={disabled}
                      >
                        <Icon size="sm">
                          <X />
                        </Icon>
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {(displayError || helperText) && (
          <div className={styles.footer}>
            {displayError ? (
              <span id={errorId} className={styles.errorText} role="alert">
                {displayError}
              </span>
            ) : (
              <span id={helperId} className={styles.helperText}>
                {helperText}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)

FileInput.displayName = 'FileInput'
