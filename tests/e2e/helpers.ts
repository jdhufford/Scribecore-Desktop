import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const root = resolve(__dirname, '..', '..')

export function tempDataDir(): string {
  return mkdtempSync(join(tmpdir(), 'scribecore-e2e-'))
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

/** Launch the built app against a throwaway data folder. */
export async function launch(dataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  delete env['ELECTRON_RENDERER_URL']
  delete env['ELECTRON_RUN_AS_NODE']
  env['SCRIBECORE_DATA_DIR'] = dataDir
  const app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: 'ScribeCore', level: 1 })).toBeVisible()
  return { app, page }
}

/** Make native dialogs (dialog.showMessageBox) answer with the given button index. */
export async function answerDialogs(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, r) => {
    const reply = async () => ({ response: r, checkboxChecked: false })
    dialog.showMessageBox = reply as typeof dialog.showMessageBox
  }, response)
}

/** Click a menu item by its labels, e.g. ['&Edit', '&Undo']. */
export async function clickMenu(app: ElectronApplication, path: string[]): Promise<void> {
  await app.evaluate(({ Menu, BrowserWindow }, labels) => {
    let items = Menu.getApplicationMenu()?.items ?? []
    for (let i = 0; i < labels.length; i++) {
      const item = items.find((it) => it.label === labels[i])
      if (!item) throw new Error(`Menu item not found: ${labels[i]}`)
      if (i === labels.length - 1) {
        item.click(undefined, BrowserWindow.getAllWindows()[0], undefined as never)
        return
      }
      items = item.submenu?.items ?? []
    }
  }, path)
}

export async function addEntry(
  page: Page,
  entry: { task: string; notes?: string; tags?: string[]; date?: string },
): Promise<void> {
  await page.getByRole('button', { name: '+ New Entry' }).click()
  const form = page.locator('form.entry-form')
  if (entry.date) await form.getByLabel('Date').fill(entry.date)
  await form.getByLabel('Task').fill(entry.task)
  if (entry.notes) await form.getByLabel('Notes').fill(entry.notes)
  for (const tag of entry.tags ?? []) {
    await form.getByLabel('Add tag').fill(tag)
    await form.getByLabel('Add tag').press('Enter')
  }
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toHaveCount(0)
}

export function entryItems(page: Page) {
  return page.locator('ul.entries > li')
}

export function sidebarTag(page: Page, name: string) {
  return page.locator('aside button.tag').filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) })
}
