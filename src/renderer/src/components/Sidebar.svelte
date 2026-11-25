<script lang="ts">
  import type { TagCount, TagMode } from '../../../shared/types'
  import { S } from '../lib/strings'

  interface Props {
    tags: TagCount[]
    selected: string[]
    tagMode: TagMode
    search: string
    onsearch: (text: string) => void
    ontoggletag: (tag: string) => void
    oncleartags: () => void
    ontagmode: (mode: TagMode) => void
    onnew: () => void
  }
  let { tags, selected, tagMode, search, onsearch, ontoggletag, oncleartags, ontagmode, onnew }: Props = $props()

  let searchInput: HTMLInputElement | undefined = $state()
  export function focusSearch(): void {
    searchInput?.focus()
    searchInput?.select()
  }

  const usedTags = $derived(tags.filter((t) => t.count > 0 || selected.includes(t.name)))
</script>

<aside class="sidebar" aria-label="Filters">
  <button type="button" class="primary new" onclick={onnew}>+ {S.newEntry}</button>

  <label class="search">
    <span class="visually-hidden">{S.search}</span>
    <input
      bind:this={searchInput}
      type="search"
      value={search}
      oninput={(e) => onsearch(e.currentTarget.value)}
      placeholder={S.searchPlaceholder}
    />
  </label>

  <section class="tags" aria-labelledby="tags-heading">
    <div class="tags-header">
      <h2 id="tags-heading">{S.tags}</h2>
      {#if selected.length > 0}
        <button type="button" class="link" onclick={oncleartags}>{S.clearFilters}</button>
      {/if}
    </div>

    {#if selected.length > 1}
      <div class="mode" role="radiogroup" aria-label="Match">
        <span>Match</span>
        <button
          type="button"
          role="radio"
          aria-checked={tagMode === 'and'}
          title={S.matchAllHint}
          onclick={() => ontagmode('and')}>{S.matchAll}</button
        >
        <button
          type="button"
          role="radio"
          aria-checked={tagMode === 'or'}
          title={S.matchAnyHint}
          onclick={() => ontagmode('or')}>{S.matchAny}</button
        >
      </div>
    {/if}

    {#if usedTags.length === 0}
      <p class="muted">{S.noTags}</p>
    {:else}
      <ul>
        {#each usedTags as tag (tag.name)}
          <li>
            <button
              type="button"
              class="tag"
              class:active={selected.includes(tag.name)}
              aria-pressed={selected.includes(tag.name)}
              onclick={() => ontoggletag(tag.name)}
            >
              <span class="name">{tag.name}</span>
              <span class="count">{tag.count}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 16px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }
  .new {
    width: 100%;
    padding: 10px;
  }
  .search input {
    width: 100%;
  }
  .tags-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  h2 {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 8px 0;
    font-size: 0.9em;
    color: var(--text-secondary);
  }
  .mode span {
    margin-right: 4px;
  }
  .mode button {
    background: var(--bg-card);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 2px 12px;
    border-radius: 999px;
  }
  .mode button[aria-checked='true'] {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
    color: #fff;
  }
  ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .tag {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    background: none;
    color: var(--text);
    padding: 5px 10px;
    border-radius: 8px;
    text-align: left;
  }
  .tag:hover {
    background: var(--tag-bg);
  }
  .tag.active {
    background: var(--accent-strong);
    color: #fff;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }
  .muted {
    color: var(--text-secondary);
    font-size: 0.9em;
  }
</style>
