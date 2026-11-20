<script lang="ts" module>
  export interface ToastData {
    id: number
    message: string
    actionLabel?: string
    action?: () => void
    kind?: 'info' | 'error'
  }
</script>

<script lang="ts">
  interface Props {
    toast: ToastData | null
    ondismiss: () => void
  }
  let { toast, ondismiss }: Props = $props()

  const TIMEOUT_MS = 8000

  $effect(() => {
    if (!toast) return
    const timer = setTimeout(ondismiss, toast.kind === 'error' ? TIMEOUT_MS * 2 : TIMEOUT_MS)
    return () => clearTimeout(timer)
  })
</script>

<div class="toast-region" aria-live="polite">
  {#if toast}
    <div class="toast" class:error={toast.kind === 'error'} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      {#if toast.action && toast.actionLabel}
        <button
          type="button"
          class="action"
          onclick={() => {
            toast?.action?.()
            ondismiss()
          }}>{toast.actionLabel}</button
        >
      {/if}
      <button type="button" class="close" aria-label="Dismiss" onclick={ondismiss}>×</button>
    </div>
  {/if}
</div>

<style>
  .toast-region {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 50;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--toast-bg);
    color: var(--toast-text);
    padding: 10px 12px 10px 18px;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
  }
  .toast.error {
    background: var(--error-bg);
    color: var(--error);
  }
  .action {
    background: none;
    color: var(--toast-action);
    font-weight: 700;
    padding: 4px 8px;
  }
  .close {
    background: none;
    color: inherit;
    opacity: 0.7;
    padding: 0 6px;
    font-size: 1.2em;
  }
</style>
