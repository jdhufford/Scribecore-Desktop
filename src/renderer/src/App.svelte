<script lang="ts">
  import type { AppInfo } from '../../shared/types'

  let info = $state<AppInfo | null>(null)
  let error = $state<string | null>(null)

  window.scribecore
    .getAppInfo()
    .then((result) => (info = result))
    .catch((err: unknown) => (error = String(err)))
</script>

<main class="shell">
  <header class="header">
    <h1>ScribeCore</h1>
    <p class="tagline">Your work log, on your computer.</p>
  </header>

  <section class="card">
    <h2>Development build</h2>
    <p>
      This is the project skeleton. Entries, tags, search, import and export arrive in the next
      milestones (see <code>docs/SPEC.md</code>).
    </p>
    {#if info}
      <dl class="facts">
        <dt>Version</dt>
        <dd>{info.version}</dd>
        <dt>Electron</dt>
        <dd>{info.electron} (Chromium {info.chrome})</dd>
        <dt>Platform</dt>
        <dd>{info.platform} {info.arch}</dd>
      </dl>
    {:else if error}
      <p class="error">Could not reach the main process: {error}</p>
    {:else}
      <p class="muted">Loading…</p>
    {/if}
    <button type="button" onclick={() => window.scribecore.openReleasesPage()}>
      Open the releases page
    </button>
  </section>
</main>

<style>
  .shell {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px;
  }
  .header {
    margin-bottom: 24px;
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
  }
  .muted {
    color: var(--text-secondary);
  }
  .error {
    color: var(--error);
  }
</style>
