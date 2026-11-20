<script lang="ts">
  import type { Activity, ViewMode } from '../../../shared/types'
  import { formatDate } from '../lib/dates'
  import { S } from '../lib/strings'

  interface Props {
    entries: Activity[]
    locale: string
    viewMode: ViewMode
    selectedId: number | null
    filtered: boolean
    onselect: (id: number) => void
    onedit: (entry: Activity) => void
    ontrash: (entry: Activity) => void
    ontag: (tag: string) => void
  }
  let { entries, locale, viewMode, selectedId, filtered, onselect, onedit, ontrash, ontag }: Props = $props()

  let expanded = $state<Set<number>>(new Set())

  function isLong(notes: string | null): boolean {
    return !!notes && (notes.length > 280 || notes.split('\n').length > 3)
  }

  function toggle(id: number): void {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expanded = next
  }

  // Keep the selected entry visible when it changes from the keyboard.
  $effect(() => {
    if (selectedId === null) return
    document.getElementById(`entry-${selectedId}`)?.scrollIntoView({ block: 'nearest' })
  })
</script>

{#if entries.length === 0}
  <div class="empty" role="status">
    <h2>{filtered ? S.noMatchesTitle : S.emptyTitle}</h2>
    <p>{filtered ? S.noMatchesBody : S.emptyBody}</p>
  </div>
{:else}
  <p class="count" role="status">{S.entryCount(entries.length)}</p>
  <ul class="entries" class:compact={viewMode === 'compact'} aria-label="Entries">
    {#each entries as entry (entry.id)}
      <!-- Mouse selection here; the keyboard equivalent (arrows, Enter, Delete) is handled app-wide. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <li
        id={`entry-${entry.id}`}
        class="entry"
        class:selected={entry.id === selectedId}
        aria-current={entry.id === selectedId ? 'true' : undefined}
        onclick={() => onselect(entry.id)}
        ondblclick={() => onedit(entry)}
      >
        <div class="head">
          <time class="date" datetime={entry.date}>{formatDate(entry.date, locale)}</time>
          <span class="task">{entry.task}</span>
          {#if viewMode === 'compact' && entry.tags.length > 0}
            <span class="tags inline">
              {#each entry.tags as tag (tag)}
                <button type="button" class="tag" onclick={(e) => (e.stopPropagation(), ontag(tag))}>{tag}</button>
              {/each}
            </span>
          {/if}
          <span class="actions">
            <button type="button" class="link" onclick={(e) => (e.stopPropagation(), onedit(entry))}>{S.edit}</button>
            <button
              type="button"
              class="link danger"
              aria-label={`${S.moveToTrash}: ${entry.task}`}
              onclick={(e) => (e.stopPropagation(), ontrash(entry))}>{S.moveToTrash}</button
            >
          </span>
        </div>

        {#if viewMode === 'normal'}
          {#if entry.notes}
            <p class="notes" class:clamped={isLong(entry.notes) && !expanded.has(entry.id)}>{entry.notes}</p>
            {#if isLong(entry.notes)}
              <button type="button" class="link more" onclick={(e) => (e.stopPropagation(), toggle(entry.id))}>
                {expanded.has(entry.id) ? S.showLess : S.showMore}
              </button>
            {/if}
          {/if}
          {#if entry.tags.length > 0}
            <div class="tags">
              {#each entry.tags as tag (tag)}
                <button type="button" class="tag" onclick={(e) => (e.stopPropagation(), ontag(tag))}>{tag}</button>
              {/each}
            </div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .count {
    margin: 0 0 8px;
    color: var(--text-secondary);
    font-size: 0.9em;
  }
  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .entry {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    cursor: default;
  }
  .entry.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 14px;
    min-width: 0;
  }
  .date {
    flex: none;
    color: var(--text-secondary);
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
    min-width: 9.5em;
  }
  .task {
    flex: 1;
    font-weight: 600;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .actions {
    flex: none;
    display: flex;
    gap: 12px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .entry:hover .actions,
  .entry.selected .actions,
  .entry:focus-within .actions {
    opacity: 1;
  }
  .notes {
    margin: 8px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text);
  }
  .notes.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .more {
    margin-top: 4px;
    font-size: 0.9em;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .tags.inline {
    margin: 0;
    flex: none;
    max-width: 40%;
    overflow: hidden;
    flex-wrap: nowrap;
  }
  .tag {
    background: var(--tag-bg);
    color: var(--tag-text);
    border-radius: 999px;
    padding: 1px 10px;
    font-size: 0.85em;
  }
  .tag:hover {
    background: var(--accent-strong);
    color: #fff;
  }
  .compact {
    gap: 0;
  }
  .compact .entry {
    border-radius: 0;
    border-width: 0 0 1px;
    padding: 6px 12px;
  }
  .compact .entry:first-child {
    border-top-width: 1px;
  }
  .compact .task {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }
  .empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }
  .empty h2 {
    color: var(--text);
    font-size: 1.2rem;
  }
</style>
