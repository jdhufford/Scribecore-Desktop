<script lang="ts">
  // Temporary developer screen for milestone 2: proves the database works end
  // to end. Milestone 3 replaces it with the real UI.
  import type { Activity, AppInfo } from '../../shared/types'

  let info = $state<AppInfo | null>(null)
  let entries = $state<Activity[]>([])
  let error = $state<string | null>(null)
  let task = $state('')
  let date = $state(localToday())

  function localToday(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  async function refresh(): Promise<void> {
    const result = await window.scribecore.activities.list()
    if (result.ok) entries = result.value
    else error = result.error.message
  }

  async function add(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    error = null
    const result = await window.scribecore.activities.create({ date, task, tags: ['test'] })
    if (!result.ok) {
      error = result.error.message
      return
    }
    task = ''
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    const result = await window.scribecore.activities.trash(id)
    if (!result.ok) error = result.error.message
    await refresh()
  }

  window.scribecore
    .getAppInfo()
    .then((result) => (info = result))
    .catch((err: unknown) => (error = String(err)))
  void refresh()
</script>

<main class="shell">
  <header class="header">
    <h1>ScribeCore</h1>
    <p class="tagline">Your work log, on your computer.</p>
  </header>

  <section class="card">
    <h2>Development build</h2>
    <p>
      The database is working. The real interface arrives in the next milestone (see
      <code>docs/SPEC.md</code>).
    </p>
    {#if info}
      <dl class="facts">
        <dt>Version</dt>
        <dd>{info.version}</dd>
        <dt>Electron</dt>
        <dd>{info.electron} (Chromium {info.chrome})</dd>
        <dt>Platform</dt>
        <dd>{info.platform} {info.arch}</dd>
        <dt>Data folder</dt>
        <dd><code>{info.dataDir}</code>{info.portable ? ' (portable)' : ''}</dd>
        <dt>Schema</dt>
        <dd>version {info.schemaVersion}</dd>
      </dl>
      {#if info.syncFolder}
        <p class="error">
          Warning: the data folder is inside {info.syncFolder}. Sync programs can damage a database
          that is open. Move the portable folder somewhere that is not synced.
        </p>
      {/if}
    {/if}
    <button type="button" onclick={() => window.scribecore.openReleasesPage()}>
      Open the releases page
    </button>
  </section>

  <section class="card">
    <h2>Test entries ({entries.length})</h2>
    <form class="add" onsubmit={add}>
      <input type="date" bind:value={date} required aria-label="Date" />
      <input type="text" bind:value={task} placeholder="What did you work on?" required aria-label="Task" />
      <button type="submit">Add</button>
    </form>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <ul class="entries">
      {#each entries.slice(0, 20) as entry (entry.id)}
        <li>
          <span class="date">{entry.date}</span>
          <span class="task">{entry.task}</span>
          <button type="button" class="link" onclick={() => remove(entry.id)}>Move to Trash</button>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  .shell {
    max-width: 760px;
    margin: 0 auto;
    padding: 32px 24px;
    display: grid;
    gap: 20px;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--accent);
  }
  .tagline {
    margin: 4px 0 0;
    color: var(--text-secondary);
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 24px;
  }
  h2 {
    margin-top: 0;
    font-size: 1.1rem;
  }
  .facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 16px 0;
  }
  dt {
    color: var(--text-secondary);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .error {
    color: var(--error);
  }
  .add {
    display: flex;
    gap: 8px;
  }
  .add input[type='text'] {
    flex: 1;
  }
  input {
    font: inherit;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
  }
  .entries {
    list-style: none;
    padding: 0;
    margin: 16px 0 0;
  }
  .entries li {
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .date {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .task {
    flex: 1;
  }
  .link {
    background: none;
    color: var(--accent);
    padding: 0;
  }
</style>
