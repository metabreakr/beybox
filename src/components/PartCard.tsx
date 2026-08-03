import { Check, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Part, PartClass } from '@/types/database';
import { PartThumb } from '@/lib/partImage';

// The five card states from the mockup, reused by Inventory and Collection.
export type CardState = 'identity' | 'picked' | 'active' | 'marked' | 'attn';

type StatDef = { key: 'atk' | 'def' | 'sta' | 'dsh'; label: string; color: string };

const BLADE_RATCHET_STATS: StatDef[] = [
  { key: 'atk', label: 'ATK', color: 'var(--atk)' },
  { key: 'def', label: 'DEF', color: 'var(--def)' },
  { key: 'sta', label: 'STA', color: 'var(--sta)' },
];

const BIT_STATS: StatDef[] = [
  { key: 'atk', label: 'ATK', color: 'var(--atk)' },
  { key: 'dsh', label: 'DSH', color: 'var(--bal)' },
  { key: 'sta', label: 'STA', color: 'var(--sta)' },
];

const STAT_MAX = 100;

function statsFor(part: Part): StatDef[] {
  return part.part_class === 'bit' ? BIT_STATS : BLADE_RATCHET_STATS;
}

function typeColor(type: string | null): string {
  switch (type?.toLowerCase()) {
    case 'attack':
      return 'var(--atk)';
    case 'defense':
      return 'var(--def)';
    case 'stamina':
      return 'var(--sta)';
    case 'balance':
      return 'var(--bal)';
    default:
      return 'var(--dim)';
  }
}

function typeLabel(type: string | null): string {
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

// First non-null product code, e.g. "UX-11".
function productCode(part: Part): string | null {
  if (part.product_codes && part.product_codes.length > 0) {
    return part.product_codes[0];
  }
  return null;
}

type BarProps = { def: StatDef; value: number | null };

function StatBar({ def, value }: BarProps) {
  const pct = value == null ? 0 : Math.max(2, Math.min(100, (value / STAT_MAX) * 100));
  return (
    <div className="bar">
      <span>{def.label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: def.color }} />
      </div>
    </div>
  );
}

// Compact separator joiner: omits null/empty parts and their separators entirely.
function joinSub(parts: (string | null)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' · ');
}

export type PartCardProps = {
  part: Part;
  state: CardState;
  selected: boolean;
  owned: boolean;
  onSelect: () => void;
  onOwn?: () => void;
  // Inventory-only variants. When `variant` is 'inventory', the actions row
  // shows a quantity stepper + delete control instead of the Own toggle.
  variant?: 'explore' | 'inventory';
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
};

export function PartCard({
  part,
  state,
  selected,
  onSelect,
  onOwn,
  owned,
  variant = 'explore',
  quantity,
  onIncrement,
  onDecrement,
  onDelete,
  onEdit,
}: PartCardProps) {
  const stats = statsFor(part);
  const isBanned = part.banned;
  const isCustom = part.owner_id != null;

  // Inventory cards are always owned; the badge reflects custom/ban/type.
  const badgeText =
    isBanned
      ? 'WBO ban'
      : isCustom
        ? 'Custom'
        : variant === 'inventory'
          ? typeLabel(part.type) || 'Owned'
          : owned
            ? 'Owned'
            : typeLabel(part.type);
  const badgeColor = isBanned
    ? 'var(--warn)'
    : isCustom
      ? 'var(--accent)'
      : variant === 'inventory'
        ? typeColor(part.type)
        : owned
          ? 'var(--ok)'
          : typeColor(part.type);

  const classes = ['card'];
  if (selected) classes.push('picked');
  else if (state !== 'identity') classes.push(state);
  if (isBanned) classes.push('attn');

  // Subtitle differs by class and omits null fields.
  let sub: React.ReactNode;
  if (isBanned && part.ban_reason) {
    sub = <span style={{ color: 'var(--warn)' }}>{part.ban_reason}</span>;
  } else if (part.part_class === 'blade') {
    const integrated = part.ratchet_integrated;
    if (integrated) {
      sub = joinSub([productCode(part), 'integrated ratchet']);
    } else if (part.modes && part.modes.length > 1) {
      sub = joinSub([productCode(part), 'mode change']);
    } else {
      sub = joinSub([
        productCode(part),
        part.spin,
        part.weight_g != null ? `${part.weight_g} g` : null,
      ]);
    }
  } else if (part.part_class === 'ratchet') {
    sub = joinSub([
      part.sides != null ? `${part.sides} sides` : null,
      part.height_mm != null ? `${part.height_mm.toFixed(1)} mm` : null,
      part.weight_g != null ? `${part.weight_g} g` : null,
    ]);
  } else {
    // bit
    sub = joinSub([
      part.short_name ?? part.name,
      part.gear != null ? `gear ${part.gear}` : null,
      part.weight_g != null ? `${part.weight_g} g` : null,
    ]);
  }

  return (
    <div className={classes.join(' ')}>
      <div className="thumb">
        <button
          className={`ck${selected ? ' on' : ''}`}
          title={selected ? 'Selected' : 'Select'}
          aria-pressed={selected}
          onClick={onSelect}
        >
          <Check size={11} strokeWidth={3.2} />
        </button>
        <span className="badge" style={{ color: badgeColor }}>
          {badgeText}
        </span>
        <PartThumb
          image={part.image}
          alt={part.display_name}
          partClass={part.part_class}
          type={part.type}
          banned={isBanned}
        />
      </div>
      <div className="cbody">
        <div className="cname">{part.display_name}</div>
        <div className="csub">{sub}</div>
        <div className="bars">
          {stats.map((def) => (
            <StatBar key={def.key} def={def} value={part[def.key]} />
          ))}
        </div>
        <div className="actions">
          {variant === 'inventory' ? (
            <>
              <div className="stepper">
                <button
                  className="b sm own step"
                  onClick={onDecrement}
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                <span className="qty">{quantity ?? 1}</span>
                <button
                  className="b sm own step"
                  onClick={onIncrement}
                  title="Increase quantity"
                  aria-label="Increase quantity"
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>
              {isCustom && onEdit && (
                <button
                  className="b sm edit"
                  onClick={onEdit}
                  title="Edit custom part"
                  aria-label="Edit custom part"
                >
                  <Pencil size={12} strokeWidth={2.5} />
                </button>
              )}
              <button
                className="b sm del"
                onClick={onDelete}
                title="Remove from inventory"
                aria-label="Remove from inventory"
              >
                <Trash2 size={12} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <button
              className={`b own${owned ? ' set' : ''}`}
              onClick={onOwn}
            >
              {owned ? 'Owned' : 'Own'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { statsFor, typeColor, typeLabel, productCode, joinSub };
