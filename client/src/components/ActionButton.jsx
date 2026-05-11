import { Loader2 } from 'lucide-react';

export default function ActionButton({
  variant = 'primary',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled = false,
  ...rest
}) {
  const variantClass =
    variant === 'positive' ? 'btn-positive' : variant === 'negative' ? 'btn-negative' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
  return (
    <button
      type="button"
      className={`btn ${variantClass} ${className}`}
      {...rest}
      disabled={loading || disabled}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : Icon ? <Icon size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}
