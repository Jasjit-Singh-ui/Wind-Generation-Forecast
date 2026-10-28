export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-box" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state-box" role="alert">
      <strong>Something went wrong</strong>
      <span>{error.message}</span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
