import { expect, test, type ElectronApplication } from '@playwright/test'
import {
  addEntry,
  answerDialogs,
  clickMenu,
  entryItems,
  launch as launchApp,
  removeDir,
  sidebarTag,
  tempDataDir,
} from './helpers'

let dataDir: string
const launched: ElectronApplication[] = []
const launch = async (dir: string) => {
  const r = await launchApp(dir)
  launched.push(r.app)
  return r
}

test.beforeEach(() => {
  dataDir = tempDataDir()
})
test.afterEach(async () => {
  for (const app of launched.splice(0)) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy())).catch(() => {})
    await app.close().catch(() => {})
  }
  removeDir(dataDir)
})

test('shows the empty state on first run', async () => {
  const { app, page } = await launch(dataDir)
  await expect(page.getByText('Nothing logged yet')).toBeVisible()
  await app.close()
})

test('creates, edits and filters entries with AND/OR tags', async () => {
  const { app, page } = await launch(dataDir)
  await addEntry(page, { task: 'Quarterly report', notes: 'Sent to finance team', tags: ['Reports', 'finance'], date: '2026-03-01' })
  await addEntry(page, { task: 'Budget review', tags: ['finance'], date: '2026-03-02' })
  await expect(entryItems(page)).toHaveCount(2)
  await expect(entryItems(page).first()).toContainText('Budget review')
  await expect(sidebarTag(page, 'finance')).toContainText('2')

  // Tags were normalized to lowercase.
  await expect(sidebarTag(page, 'reports')).toBeVisible()

  await sidebarTag(page, 'finance').click()
  await expect(entryItems(page)).toHaveCount(2)
  await sidebarTag(page, 'reports').click()
  await expect(entryItems(page)).toHaveCount(1) // AND
  await page.getByRole('radio', { name: 'Any' }).click()
  await expect(entryItems(page)).toHaveCount(2) // OR
  await page.getByRole('button', { name: 'Clear' }).click()

  await entryItems(page).filter({ hasText: 'Budget review' }).getByRole('button', { name: 'Edit' }).click()
  const form = page.locator('form.entry-form')
  await expect(form.getByLabel('Task')).toHaveValue('Budget review')
  await form.getByLabel('Task').fill('Budget review (final)')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(entryItems(page).filter({ hasText: 'Budget review (final)' })).toHaveCount(1)
  await app.close()
})

test('searches task and notes', async () => {
  const { app, page } = await launch(dataDir)
  await addEntry(page, { task: 'Patched servers', notes: 'Kernel 6.12 rollout' })
  await addEntry(page, { task: 'Team meeting' })
  await page.getByPlaceholder('Search tasks and notes…').fill('kernel')
  await expect(entryItems(page)).toHaveCount(1)
  await expect(entryItems(page).first()).toContainText('Patched servers')
  await page.getByPlaceholder('Search tasks and notes…').fill('nothing matches this')
  await expect(page.getByText('No matching entries')).toBeVisible()
  await app.close()
})

test('moves an entry to Trash and undoes it from the toast and from Edit > Undo', async () => {
  const { app, page } = await launch(dataDir)
  await addEntry(page, { task: 'Keep me' })
  const item = entryItems(page).filter({ hasText: 'Keep me' })

  await item.getByRole('button', { name: /Move to Trash/ }).click()
  await expect(entryItems(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(entryItems(page)).toHaveCount(1)

  // Keyboard: select, Delete, then Edit > Undo (Ctrl+Z) outside a text field.
  await item.click()
  await page.keyboard.press('Delete')
  await expect(entryItems(page)).toHaveCount(0)
  await clickMenu(app, ['&Edit', '&Undo'])
  await expect(entryItems(page)).toHaveCount(1)
  await app.close()
})

test('asks before discarding unsaved changes', async () => {
  const { app, page } = await launch(dataDir)
  await page.getByRole('button', { name: '+ New Entry' }).click()
  const form = page.locator('form.entry-form')
  await form.getByLabel('Task').fill('Half-written')

  await answerDialogs(app, 0) // "Keep editing"
  await form.getByRole('button', { name: 'Cancel' }).click()
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Task')).toHaveValue('Half-written')

  await answerDialogs(app, 1) // "Discard"
  await form.getByRole('button', { name: 'Cancel' }).click()
  await expect(form).toHaveCount(0)
  await app.close()
})

test('keeps entries and settings across restarts', async () => {
  let { app, page } = await launch(dataDir)
  await addEntry(page, { task: 'Survives a restart', tags: ['persist'] })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: /Compact/ }).check()
  await page.getByRole('radio', { name: 'Dark' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('ul.entries.compact')).toBeVisible()
  await app.close()

  ;({ app, page } = await launch(dataDir))
  await expect(entryItems(page).filter({ hasText: 'Survives a restart' })).toHaveCount(1)
  await expect(page.locator('ul.entries.compact')).toBeVisible()
  await expect(sidebarTag(page, 'persist')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark')
  await app.close()
})

test('blocks network access from the window', async () => {
  const { app, page } = await launch(dataDir)
  const result = await page.evaluate(() =>
    fetch('https://example.com').then(
      () => 'reached',
      () => 'blocked',
    ),
  )
  expect(result).toBe('blocked')
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  await app.close()
})
