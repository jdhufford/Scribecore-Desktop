<script lang="ts">
  import type { AppInfo, Settings, Theme, ViewMode } from '../../../shared/types'
  import { S } from '../lib/strings'

  interface Props {
    settings: Settings
    info: AppInfo | null
    onchange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
    onclose: () => void
  }
  let { settings, info, onchange, onclose }: Props = $props()

  let dialog: HTMLDialogElement | undefined = $state()

  $effect(() => {
    dialog?.showModal()
  })

  const themes: [Theme, string][] = [
    ['system', S.themeSystem],
    ['light', S.themeLight],
    ['dark', S.themeDark],
  ]
  const views: [ViewMode, string, string][] = [
    ['normal', S.viewNormal, S.viewNormalHint],
    ['compact', S.viewCompact, S.viewCompactHint],
  ]
</script>

<dialog bind:this={dialog} class="settings" aria-labelledby="settings-title" onclose={onclose}>
  <header>
    <h2 id="settings-title">{S.settings}</h2>
    <button type="button" class="close" aria-label={S.close} onclick={() => dialog?.close()}>×</button>
  </header>

  <fieldset>
    <legend>{S.theme}</legend>
    {#each themes as [value, label] (value)}
      <label class="option">
        <input
          type="radio"
          name="theme"
          {value}
          checked={settings.theme === value}
          onchange={() => onchange('theme', value)}
        />
        {label}
      </label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>{S.view}</legend>
    {#each views as [value, label, hint] (value)}
      <label class="option">
        <input
          type="radio"
          name="view"
          {value}
          checked={settings.viewMode === value}
          onchange={() => onchange('viewMode', value)}
        />
        <span>{label} <small>{hint}</small></span>
      </label>
    {/each}
  </fieldset>

  {#if info}
    <section class="data">
      <h3>{S.dataFolder}</h3>
      <code>{info.dataDir}</code>
      {#if info.portable}<p class="muted">({S.portable})</p>{/if}
    </section>
  {/if}

  <footer>
    <button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button>
  </footer>
</dialog>

<style>
  .settings {
    width: min(480px, 90vw);
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-card);
    color: var(--text);
    padding: 20px 24px;
  }
  .settings::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .close {
    background: none;
    color: var(--text);
    font-size: 1.4em;
    padding: 0 8px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 18px 0 0;
    display: grid;
    gap: 6px;
  }
  legend {
    font-weight: 600;
    margin-bottom: 6px;
  }
  .option {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  small {
    color: var(--text-secondary);
    margin-left: 6px;
  }
  .data {
    margin-top: 18px;
  }
  h3 {
    font-size: 1rem;
    margin: 0 0 6px;
  }
  code {
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--text-secondary);
    margin: 4px 0 0;
  }
  footer {
    margin-top: 22px;
    display: flex;
    justify-content: flex-end;
  }
</style>
