export default function ProgressBar({ value, max, color = 'var(--accent)' }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 6, background: 'var(--bg-elevated)' }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  );
}
