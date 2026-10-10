export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="icon-button" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 3-.5 2-2 .9-1.8-.6-2 3.4 1.5 1.4v2.3L3.2 14l2 3.5 2-.6 1.9 1 .4 2.1h4.9l.5-2 2-.9 1.8.6 2-3.5-1.5-1.4v-2.3l1.5-1.5-2-3.4-2 .6-1.9-1L14.4 3Z" />
        <circle cx="12" cy="11.5" r="3" />
      </svg>
    </button>
  );
}
