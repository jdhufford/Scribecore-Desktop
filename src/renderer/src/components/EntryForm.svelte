<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { Activity, ActivityInput } from '../../../shared/types'
  import { api, ApiError, unwrap } from '../lib/api'
  import { daysFromToday, todayLocal } from '../lib/dates'
  import { S } from '../lib/strings'
  import TagInput from './TagInput.svelte'

  interface Props {
    entry: Activity | null
    knownTags: string[]
    onsave: (input: ActivityInput) => Promise<void>
    oncancel: () => void
    ondirty: (dirty: boolean) => void
  }
  let { entry, knownTags, onsave, oncancel, ondirty }: Props = $props()

  // Snapshot of the fields as loaded, to detect unsaved changes. The parent
  // recreates this component (keyed) for each entry, so reading `entry` once is intended.
  const initial = untrack(() => ({
    date: entry?.date ?? todayLocal(),
    task: entry?.task ?? '',
    notes: entry?.notes ?? '',
    tags: [...(entry?.tags ?? [])],
  }))
  let date = $state(initial.date)
  let task = $state(initial.task)
  let notes = $state(initial.notes)
  let tags = $state<string[]>([...initial.tags])
  let suggestions = $state<string[]>([])
  let saving = $state(false)
  let errors = $state<Record<string, string>>({})
  let taskInput: HTMLInputElement | undefined = $state()
  let formEl: HTMLFormElement | undefined = $state()

  const dirty = $derived(
    date !== initial.date ||
      task !== initial.task ||
      notes !== initial.notes ||
      tags.join('\u0000') !== initial.tags.join('\u0000'),
  )
  const ahead = $derived(daysFromToday(date))

  $effect(() => {
    ondirty(dirty)
  })

  // Tag suggestions follow the text, debounced.
  let suggestTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    const t = task
    const n = notes
    clearTimeout(suggestTimer)
    if (!t.trim() && !n.trim()) {
      suggestions = []
      return
    }
    suggestTimer = setTimeout(async () => {
      try {
        suggestions = await unwrap(api.tags.suggest(t, n))
      } catch {
        suggestions = []
      }
    }, 350)
    return () => clearTimeout(suggestTimer)
  })

  onMount(() => {
    taskInput?.focus()
  })

  export function submit(): void {
    formEl?.requestSubmit()
  }

  async function onsubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (saving) return
    errors = {}
    saving = true
    try {
      // $state values are proxies, which IPC cannot clone: send a plain snapshot.
      await onsave({ date, task, notes, tags: $state.snapshot(tags) })
    } catch (err) {
      if (err instanceof ApiError && err.field) errors = { [err.field]: err.message }
      else errors = { form: err instanceof Error ? err.message : S.genericError }
    } finally {
      saving = false
    }
  }
</script>

<form class="entry-form" bind:this={formEl} {onsubmit} aria-labelledby="form-title" novalidate>
  <h2 id="form-title">{entry ? S.editEntry : S.newEntry}</h2>

  <div class="row">
    <label class="field date-field">
      <span>{S.date}</span>
      <input type="date" bind:value={date} required aria-invalid={!!errors['date']} />
    </label>
    <label class="field task-field">
      <span>{S.task}</span>
      <input
        type="text"
        bind:this={taskInput}
        bind:value={task}
        required
        maxlength="500"
        placeholder={S.taskPlaceholder}
        aria-invalid={!!errors['task']}
      />
    </label>
  </div>
  {#if errors['date']}<p class="field-error" role="alert">{errors['date']}</p>{/if}
  {#if errors['task']}<p class="field-error" role="alert">{errors['task']}</p>{/if}
  {#if ahead > 1}<p class="hint" role="status">{S.futureDate(ahead)}</p>{/if}

  <label class="field">
    <span>{S.notes}</span>
    <textarea bind:value={notes} rows="4" placeholder={S.notesPlaceholder}></textarea>
  </label>

  <div class="field">
    <span>{S.tags}</span>
    <TagInput {tags} {suggestions} known={knownTags} onchange={(next) => (tags = next)} />
    {#if errors['tags']}<p class="field-error" role="alert">{errors['tags']}</p>{/if}
  </div>

  {#if errors['form']}<p class="field-error" role="alert">{errors['form']}</p>{/if}

  <div class="actions">
    <button type="submit" class="primary" disabled={saving}>{S.save}</button>
    <button type="button" class="secondary" onclick={oncancel}>{S.cancel}</button>
    <span class="shortcut-hint">Ctrl+S to save · Esc to cancel</span>
  </div>
</form>

<style>
  .entry-form {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 12px;
    padding: 18px 22px;
    margin-bottom: 20px;
    display: grid;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 12px;
  }
  .field {
    display: grid;
    gap: 4px;
  }
  .field > span {
    font-weight: 600;
    font-size: 0.9em;
  }
  textarea {
    resize: vertical;
    min-height: 80px;
  }
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .shortcut-hint {
    margin-left: auto;
    color: var(--text-secondary);
    font-size: 0.85em;
  }
  .hint {
    margin: 0;
    color: var(--warning);
    font-size: 0.9em;
  }
</style>
