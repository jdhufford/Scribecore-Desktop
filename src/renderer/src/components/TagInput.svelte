<script lang="ts">
  import { S } from '../lib/strings'

  interface Props {
    tags: string[]
    suggestions: string[]
    known: string[]
    onchange: (tags: string[]) => void
  }
  let { tags, suggestions, known, onchange }: Props = $props()

  let text = $state('')
  let error = $state<string | null>(null)
  const listId = `known-tags-${Math.random().toString(36).slice(2)}`

  const visibleSuggestions = $derived(suggestions.filter((s) => !tags.includes(s)))

  function normalize(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').toLowerCase()
  }

  function add(raw: string): void {
    error = null
    const parts = raw.split(',')
    const next = [...tags]
    for (const part of parts) {
      const tag = normalize(part)
      if (!tag) continue
      if (tag.length > 50) {
        error = `"${tag.slice(0, 20)}…" is longer than 50 characters.`
        continue
      }
      if (!next.includes(tag)) next.push(tag)
    }
    if (next.length !== tags.length) onchange(next)
  }

  function remove(tag: string): void {
    onchange(tags.filter((t) => t !== tag))
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(text)
      text = ''
    } else if (event.key === 'Backspace' && text === '' && tags.length > 0) {
      remove(tags[tags.length - 1]!)
    }
  }

  function onblur(): void {
    if (text.trim()) {
      add(text)
      text = ''
    }
  }
</script>

<div class="tag-input">
  <div class="chips" role="list" aria-label="Selected tags">
    {#each tags as tag (tag)}
      <span class="chip" role="listitem">
        {tag}
        <button type="button" class="remove" aria-label={`Remove tag ${tag}`} onclick={() => remove(tag)}>×</button>
      </span>
    {/each}
    <input
      type="text"
      bind:value={text}
      {onkeydown}
      {onblur}
      list={listId}
      placeholder={tags.length === 0 ? S.tagPlaceholder : ''}
      aria-label={S.addTag}
      maxlength="60"
    />
  </div>
  <datalist id={listId}>
    {#each known as tag (tag)}
      <option value={tag}></option>
    {/each}
  </datalist>
  {#if error}
    <p class="field-error" role="alert">{error}</p>
  {/if}
  {#if visibleSuggestions.length > 0}
    <div class="suggestions" aria-label={S.suggested}>
      <span class="label">{S.suggested}:</span>
      {#each visibleSuggestions as tag (tag)}
        <button type="button" class="suggestion" onclick={() => add(tag)}>+ {tag}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--input-bg);
    min-height: 40px;
  }
  .chips:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .chips input {
    flex: 1;
    min-width: 160px;
    border: none;
    outline: none;
    background: transparent;
    padding: 2px 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--tag-bg);
    color: var(--tag-text);
    border-radius: 999px;
    padding: 2px 4px 2px 10px;
    font-size: 0.9em;
  }
  .remove {
    background: none;
    color: inherit;
    padding: 0 6px;
    border-radius: 999px;
    line-height: 1.2;
  }
  .remove:hover {
    background: var(--border);
  }
  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
    font-size: 0.9em;
  }
  .label {
    color: var(--text-secondary);
  }
  .suggestion {
    background: none;
    color: var(--accent-text);
    border: 1px dashed var(--accent);
    border-radius: 999px;
    padding: 1px 10px;
  }
  .suggestion:hover {
    background: var(--tag-bg);
  }
</style>
