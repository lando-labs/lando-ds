import { test, expect, type Page } from '@playwright/test'

/**
 * Real-browser regression coverage for #14 v2 — see playwright.config.ts for
 * why this exists and how to run it.
 *
 * The v1 fix (Popover API top-layer promotion) made these overlays PAINT
 * above a Modal's native <dialog>. It did not make them INTERACTIVE:
 * showModal() marks everything outside the dialog's own subtree `inert`,
 * which blocks pointer events regardless of paint order. These tests use
 * real Playwright clicks/hovers (which perform actionability + hit-testing
 * checks against the actual rendered page, unlike jsdom's fireEvent) against
 * the fixture at examples/next-app-router/app/e2e/overlays-in-modal — the
 * class of proof that was missing from the v1 close-out.
 */

const FIXTURE_URL = '/e2e/overlays-in-modal'

async function openModal(page: Page) {
  await page.getByRole('button', { name: 'Open Modal' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('Select inside a Modal', () => {
  test('click selects an option and updates the trigger', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    const trigger = page.getByRole('dialog').getByRole('combobox').first()
    await trigger.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    const option = listbox.getByRole('option', { name: 'Banana' })
    await option.click({ timeout: 5000 })

    // Real click landed on the option — onChange fired and the trigger
    // reflects the new value. Before the fix, this .click() call itself
    // times out (Playwright's actionability check reports the underlying
    // dialog content "intercepts pointer events").
    await expect(trigger).toContainText('Banana')
    await expect(listbox).not.toBeVisible()
  })

  test('hover moves the active/highlighted option', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    const trigger = page.getByRole('dialog').getByRole('combobox').first()
    await trigger.click()

    const listbox = page.getByRole('listbox')
    const cherry = listbox.getByRole('option', { name: 'Cherry' })
    await cherry.hover({ timeout: 5000 })

    await expect(cherry).toHaveClass(/highlighted/)
  })

  test('Escape closes only the listbox — Modal stays open; a second Escape closes the Modal', async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    const trigger = page.getByRole('dialog').getByRole('combobox').first()
    await trigger.click()
    await expect(page.getByRole('listbox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).not.toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

test.describe('Combobox inside a Modal', () => {
  test('click selects an option and updates the input', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    const input = page.getByPlaceholder('Combobox — type to filter')
    await input.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    await listbox.getByRole('option', { name: 'Cherry' }).click({ timeout: 5000 })

    await expect(input).toHaveValue('Cherry')
  })
})

test.describe('MultiSelect inside a Modal', () => {
  test('click selects an option and renders a chip', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    const input = page.getByPlaceholder('MultiSelect — pick several')
    await input.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    await listbox.getByRole('option', { name: 'Apple' }).click({ timeout: 5000 })

    // MultiSelect stays open after a pick (the user is likely picking
    // several in a row), so "Apple" is now visible BOTH as the new chip AND
    // still as a listbox option — assert on the chip's own remove button,
    // which is unambiguous, rather than a bare text match.
    await expect(page.getByRole('button', { name: 'Remove Apple' })).toBeVisible()
  })
})

test.describe('Dropdown inside a Modal', () => {
  test('click fires the menu item action', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    await page.getByRole('dialog').getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click({ timeout: 5000 })

    await expect(page.getByTestId('last-action')).toHaveText('modal-dropdown-item')
  })
})

test.describe('Popover inside a Modal', () => {
  test('click fires the action inside the popover content', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await openModal(page)

    await page.getByRole('dialog').getByRole('button', { name: 'Info' }).click()
    await page.getByRole('button', { name: 'Popover action' }).click({ timeout: 5000 })

    await expect(page.getByTestId('last-action')).toHaveText('modal-popover-button')
  })
})

test.describe('Standalone overlays (outside any Modal) — no regression', () => {
  test('Dropdown opens and its item is clickable without a Modal', async ({ page }) => {
    await page.goto(FIXTURE_URL)

    await page.getByRole('button', { name: 'Standalone Dropdown' }).click()
    await page.getByRole('menuitem', { name: 'Standalone Item' }).click({ timeout: 5000 })

    await expect(page.getByTestId('last-action')).toHaveText('standalone-dropdown-item')
  })
})
