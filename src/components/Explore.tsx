import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { PartCard } from '@/components/PartCard';
import type { Part, PartClass, Inventory } from '@/types/database';

type ClassFilter = 'all' | PartClass;
type LineFilter = 'all' | 'BX' | 'UX';

const CLASS_CHIPS: { label: string; value: ClassFilter }[] = [
  { label: 'All parts', value: 'all' },
  { label: 'Blades', value: 'blade' },
  { label: 'Ratchets', value: 'ratchet' },
  { label: 'Bits', value: 'bit' },
];

const LINE_OPTIONS: { label: string; value: LineFilter }[] = [
  { label: 'All lines', value: 'all' },
  { label: 'BX', value: 'BX' },
  { label: 'UX', value: 'UX' },
];

// Normalise a query the same way search_terms was derived:
// lowercase, then strip spaces and hyphens.
function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[\s-]/g, '');
}

export function Explore() {
  const { user } = useAuth();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Load the full catalogue and the user's inventory once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: partRows }, { data: invRows }] = await Promise.all([
        supabase.from('parts').select('*').order('display_name'),
        user
          ? supabase.from('inventory').select('*').eq('user_id', user.id)
          : Promise.resolve({ data: [] as Inventory[] | null }),
      ]);
      if (cancelled) return;
      setParts((partRows as Part[] | null) ?? []);
      const map: Record<string, Inventory> = {};
      for (const row of (invRows as Inventory[] | null) ?? []) {
        map[row.part_id] = row;
      }
      setInventory(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const ownedCount = useMemo(
    () => Object.keys(inventory).length,
    [inventory],
  );

  const filtered = useMemo(() => {
    if (!parts) return [];
    const q = normalizeQuery(query);
    return parts.filter((p) => {
      if (classFilter !== 'all' && p.part_class !== classFilter) return false;
      if (lineFilter !== 'all' && p.line !== lineFilter) return false;
      if (q) {
        const terms = p.search_terms ?? [];
        const hit = terms.some((t) => t.includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [parts, classFilter, lineFilter, query]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function toggleOwn(part: Part) {
    if (!user) return;
    const existing = inventory[part.id];
    if (existing) {
      // Destructive: if quantity > 1, confirm first.
      if (existing.quantity > 1) {
        const ok = window.confirm(
          `Remove all ${existing.quantity} of ${part.display_name} from your inventory?`,
        );
        if (!ok) return;
      }
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('user_id', user.id)
        .eq('part_id', part.id);
      if (error) return;
      setInventory((prev) => {
        const next = { ...prev };
        delete next[part.id];
        return next;
      });
    } else {
      const { data, error } = await supabase
        .from('inventory')
        .insert({ user_id: user.id, part_id: part.id, quantity: 1 })
        .select('*')
        .single();
      if (error) return;
      setInventory((prev) => ({ ...prev, [part.id]: data as Inventory }));
    }
  }

  // Bulk: insert all selected parts that aren't already owned.
  async function markSelectedAsOwned() {
    if (!user || selected.size === 0 || busy) return;
    const toAdd = [...selected].filter((id) => !inventory[id]);
    if (toAdd.length === 0) {
      clearSelection();
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('inventory')
      .insert(toAdd.map((part_id) => ({ user_id: user.id, part_id, quantity: 1 })))
      .select('*');
    setBusy(false);
    if (error) return;
    setInventory((prev) => {
      const next = { ...prev };
      for (const row of (data as Inventory[] | null) ?? []) {
        next[row.part_id] = row;
      }
      return next;
    });
    clearSelection();
  }

  const totalParts = parts?.length ?? 0;
  const showingCount = filtered.length;

  return (
    <>
      <div className="filters">
        <div className="find">
          <Search size={13} />
          <input
            placeholder={`Search all ${totalParts} parts`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chipset">
          {CLASS_CHIPS.map((c) => (
            <button
              key={c.value}
              className={`chip${classFilter === c.value ? ' on' : ''}`}
              onClick={() => setClassFilter(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <select
          className="sel"
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value as LineFilter)}
        >
          {LINE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="selbar">
          <span className="count">{selected.size} selected</span>
          <div className="slots" />
          <button className="b" onClick={clearSelection}>
            Deselect
          </button>
          <button className="b go" onClick={markSelectedAsOwned} disabled={busy}>
            Mark as owned
          </button>
        </div>
      )}

      <div className="grid">
        {filtered.map((part) => {
          const inv = inventory[part.id];
          return (
            <PartCard
              key={part.id}
              part={part}
              state="identity"
              selected={selected.has(part.id)}
              owned={!!inv}
              onSelect={() => toggleSelect(part.id)}
              onOwn={() => toggleOwn(part)}
            />
          );
        })}
      </div>

      {parts && filtered.length === 0 && (
        <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No parts match your search.
        </div>
      )}

      <div className="foot">
        <div className="foot-l">
          <span>
            {showingCount} part{showingCount === 1 ? '' : 's'} · {ownedCount} owned
          </span>
        </div>
        <div className="foot-r" />
      </div>
    </>
  );
}
