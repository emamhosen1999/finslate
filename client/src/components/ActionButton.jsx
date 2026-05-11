import { Loader2 } from 'lucide-react';

export default function ActionButton({
  variant = 'primary',
  loading = false,
  icon: Icon,
  children,
  className = '',
  ...rest
}) {
  const variantClass =
    variant === 'positive' ? 'btn-positive' : variant === 'negative' ? 'btn-negative' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
  return (
    <button
      type="button"
      className={`btn ${variantClass} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : Icon ? <Icon size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}
