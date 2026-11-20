<script lang="ts">
  import { onMount } from 'svelte'
  import {
    DEFAULT_SETTINGS,
    type Activity,
    type ActivityInput,
    type AppInfo,
    type MenuCommand,
    type Settings,
    type TagCount,
    type TagMode,
  } from '../../shared/types'
  import EntryForm from './components/EntryForm.svelte'
  import EntryList from './components/EntryList.svelte'
  import SettingsDialog from './components/SettingsDialog.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import Toast, { type ToastData } from './components/Toast.svelte'
  import { api, isEditable, unwrap } from './lib/api'
  import { S } from './lib/strings'

  let info = $state<AppInfo | null>(null)
  let settings = $state<Settings>({ ...DEFAULT_SETTINGS })
  let entries = $state<Activity[]>([])
  let tags = $state<TagCount[]>([])
  let search = $state('')
  let selectedTags = $state<string[]>([])
  let selectedId = $state<number | null>(null)

  // Form: null = closed; { entry: null } = new; { entry } = editing.
  let form = $state<{ entry: Activity | null; key: number } | null>(null)
  let formDirty = $state(false)
  let formRef: ReturnType<typeof EntryForm> | undefined = $state()
  let sidebarRef: ReturnType<typeof Sidebar> | undefined = $state()
  let showSettings = $state(false)

  let toast = $state<ToastData | null>(null)
  let toastSeq = 0
  // Entries moved to Trash this session, newest last, for Undo / Ctrl+Z.
  const trashedThisSession: number[] = []

  const filtered = $derived(search.trim() !== '' || selectedTags.length > 0)
  const knownTags = $derived(tags.map((t) => t.name))
  const locale = $derived(info?.locale ?? 'en-US')

  function showToast(t: Omit<ToastData, 'id'>): void {
    toast = { ...t, id: ++toastSeq }
  }

  function showError(err: unknown): void {
    showToast({ message: err instanceof Error ? err.message : S.genericError, kind: 'error' })
  }

  // ---- Data loading -------------------------------------------------------

  let loadSeq = 0
  async function refresh(): Promise<void> {
    const seq = ++loadSeq
    try {
      const [list, tagList] = await Promise.all([
        // $state arrays are proxies, which IPC cannot clone: send a plain snapshot.
        unwrap(api.activities.list({ search, tags: $state.snapshot(selectedTags), tagMode: settings.tagMode })),
        unwrap(api.tags.list()),
      ])
      if (seq !== loadSeq) return // a newer refresh has started
      entries = list
      tags = tagList
      if (selectedId !== null && !list.some((e) => e.id === selectedId)) selectedId = null
    } catch (err) {
      showError(err)
    }
  }

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  function onsearch(text: string): void {
    search = text
    clearTimeout(searchTimer)
    searchTimer = setTimeout(refresh, 250)
  }

  function toggleTag(tag: string): void {
    selectedTags = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]
    void refresh()
  }

  function addTagFilter(tag: string): void {
    if (!selectedTags.includes(tag)) toggleTag(tag)
  }

  // ---- Settings -----------------------------------------------------------

  async function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    try {
      settings = await unwrap(api.settings.set(key, value))
      if (key === 'tagMode') void refresh()
    } catch (err) {
      showError(err)
    }
  }

  function setTagMode(mode: TagMode): void {
    void changeSetting('tagMode', mode)
  }

  // ---- Form ---------------------------------------------------------------

  async function confirmDiscard(): Promise<boolean> {
    if (!form || !formDirty) return true
    return api.ui.confirm({
      message: S.discardTitle,
      confirmLabel: S.discard,
      cancelLabel: S.keepEditing,
      danger: true,
    })
  }

  function setFormDirty(dirty: boolean): void {
    if (dirty === formDirty) return
    formDirty = dirty
    api.ui.setDirty(dirty)
  }

  function closeForm(): void {
    form = null
    setFormDirty(false)
  }

  async function openNew(): Promise<void> {
    if (form?.entry === null) return // already writing a new entry
    if (!(await confirmDiscard())) return
    setFormDirty(false)
    form = { entry: null, key: Date.now() }
  }

  async function openEdit(entry: Activity): Promise<void> {
    if (form?.entry?.id === entry.id) return
    if (!(await confirmDiscard())) return
    setFormDirty(false)
    selectedId = entry.id
    form = { entry, key: Date.now() }
  }

  async function cancelForm(): Promise<void> {
    if (await confirmDiscard()) closeForm()
  }

  async function save(input: ActivityInput): Promise<void> {
    const editing = form?.entry
    const saved = editing
      ? await unwrap(api.activities.update(editing.id, input))
      : await unwrap(api.activities.create(input))
    closeForm()
    selectedId = saved.id
    await refresh()
    showToast({ message: S.saved })
  }

  // ---- Trash / undo -------------------------------------------------------

  async function trash(entry: Activity): Promise<void> {
    try {
      await unwrap(api.activities.trash(entry.id))
      if (form?.entry?.id === entry.id) closeForm()
      trashedThisSession.push(entry.id)
      await refresh()
      showToast({ message: S.movedToTrash, actionLabel: S.undo, action: () => void undoTrash(entry.id) })
    } catch (err) {
      showError(err)
    }
  }

  async function undoTrash(id?: number): Promise<void> {
    const target = id ?? trashedThisSession.at(-1)
    if (target === undefined) return
    const index = trashedThisSession.lastIndexOf(target)
    if (index >= 0) trashedThisSession.splice(index, 1)
    try {
      await unwrap(api.activities.restore(target))
      selectedId = target
      await refresh()
      showToast({ message: S.restored })
    } catch (err) {
      showError(err)
    }
  }

  // ---- Keyboard and menu --------------------------------------------------

  function moveSelection(step: number): void {
    if (entries.length === 0) return
    const index = entries.findIndex((e) => e.id === selectedId)
    const next = index < 0 ? (step > 0 ? 0 : entries.length - 1) : Math.min(Math.max(index + step, 0), entries.length - 1)
    selectedId = entries[next]!.id
  }

  function onkeydown(event: KeyboardEvent): void {
    if (showSettings) return // the dialog handles its own keys (Esc closes it)
    const ctrl = event.ctrlKey || event.metaKey
    if (ctrl && event.key.toLowerCase() === 's') {
      event.preventDefault()
      formRef?.submit()
      return
    }
    if (event.key === 'Escape' && form) {
      event.preventDefault()
      void cancelForm()
      return
    }
    if (isEditable(document.activeElement) || ctrl || event.altKey) return
    const selected = entries.find((e) => e.id === selectedId)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveSelection(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveSelection(-1)
        break
      case 'Enter':
        if (selected) {
          event.preventDefault()
          void openEdit(selected)
        }
        break
      case 'Delete':
        if (selected) {
          event.preventDefault()
          void trash(selected)
        }
        break
    }
  }

  function onMenuCommand(command: MenuCommand): void {
    switch (command) {
      case 'new-entry':
        void openNew()
        break
      case 'find':
        sidebarRef?.focusSearch()
        break
      case 'toggle-compact':
        void changeSetting('viewMode', settings.viewMode === 'compact' ? 'normal' : 'compact')
        break
      case 'settings':
        showSettings = true
        break
      case 'undo':
        // In a text field this is ordinary text undo; elsewhere it restores the last deleted entry.
        if (isEditable(document.activeElement)) document.execCommand('undo')
        else void undoTrash()
        break
    }
  }

  // Light/Dark are explicit; "system" leaves it to prefers-color-scheme.
  $effect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') delete root.dataset['theme']
    else root.dataset['theme'] = settings.theme
  })

  onMount(() => {
    const unsubscribe = api.ui.onMenuCommand(onMenuCommand)
    void (async () => {
      try {
        ;[info, settings] = await Promise.all([api.getAppInfo(), api.settings.get()])
      } catch (err) {
        showError(err)
      }
      await refresh()
    })()
    return unsubscribe
  })
</script>

<svelte:window {onkeydown} />

<div class="app">
  <Sidebar
    bind:this={sidebarRef}
    {tags}
    selected={selectedTags}
    tagMode={settings.tagMode}
    {search}
    {onsearch}
    ontoggletag={toggleTag}
    oncleartags={() => {
      selectedTags = []
      void refresh()
    }}
    ontagmode={setTagMode}
    onnew={openNew}
  />

  <main class="main">
    <header class="topbar">
      <h1>{S.appName}</h1>
      <button type="button" class="secondary" onclick={() => (showSettings = true)}>{S.settings}</button>
    </header>

    {#if info?.syncFolder}
      <p class="banner" role="alert">{S.syncWarning(info.syncFolder)}</p>
    {/if}

    {#if form}
      {#key form.key}
        <EntryForm
          bind:this={formRef}
          entry={form.entry}
          {knownTags}
          onsave={save}
          oncancel={cancelForm}
          ondirty={setFormDirty}
        />
      {/key}
    {/if}

    <EntryList
      {entries}
      {locale}
      viewMode={settings.viewMode}
      {selectedId}
      {filtered}
      onselect={(id) => (selectedId = id)}
      onedit={openEdit}
      ontrash={trash}
      ontag={addTagFilter}
    />
  </main>
</div>

{#if showSettings}
  <SettingsDialog {settings} {info} onchange={changeSetting} onclose={() => (showSettings = false)} />
{/if}

<Toast {toast} ondismiss={() => (toast = null)} />

<style>
  .app {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100vh;
  }
  .main {
    overflow-y: auto;
    padding: 20px 28px 80px;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--accent-text);
  }
  .banner {
    background: var(--warning-bg);
    color: var(--warning);
    border: 1px solid var(--warning);
    border-radius: 8px;
    padding: 10px 14px;
  }
</style>
