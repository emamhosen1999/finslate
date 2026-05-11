import {
  Utensils,
  Bus,
  ShoppingBag,
  Lightbulb,
  HeartPulse,
  Wallet,
  Banknote,
  PiggyBank,
  Landmark,
  Sparkles,
} from 'lucide-react';

const map = {
  Food: { Icon: Utensils, color: '#F0A05C' },
  Transport: { Icon: Bus, color: '#6C8EF5' },
  Shopping: { Icon: ShoppingBag, color: '#C58CF5' },
  Utilities: { Icon: Lightbulb, color: '#F0CB5C' },
  Health: { Icon: HeartPulse, color: '#F05C5C' },
  Salary: { Icon: Banknote, color: '#4CAF7D' },
  Savings: { Icon: PiggyBank, color: '#4CAF7D' },
  Loan: { Icon: Landmark, color: '#F05C5C' },
  Others: { Icon: Sparkles, color: '#7B82A3' },
};

export default function CategoryIcon({ category, size = 18 }) {
  const entry = map[category] || { Icon: Wallet, color: '#7B82A3' };
  const { Icon, color } = entry;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: size + 16,
        height: size + 16,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      <Icon size={size} />
    </span>
  );
}

export const CATEGORY_COLORS = Object.fromEntries(
  Object.entries(map).map(([k, v]) => [k, v.color]),
);
