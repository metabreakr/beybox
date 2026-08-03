import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { PartCard } from '@/components/PartCard';
import type { Part, PartClass, Inventory } from '@/types/database';

type ClassFilter = 'all' | PartClass;

const CLASS_CHIPS: { label: string; value: ClassFilter }[] = [
  { label: 'All parts', value: 'all' },
  { label: 'Blades', value: 'blade' },
  { label: 'Ratchets', value: 'ratchet' },
  { label: 'Bits', value: 'bit' },
];

const CUSTOM_ONLY = 'custom';
const CATALOGUE_ONLY = 'catalogue';
type SourceFilter = 'all' | typeof CUSTOM_ONLY | typeof CATALOGUE_ONLY;

const SOURCE_OPTIONS: { label: string; value: SourceFilter }[] = [
  { label: 'All sources', value: 'all' },
  { label: 'Catalogue', value: CATALOGUE_ONLY },
  { label: 'Custom', value: CUSTOM_ONLY },
];

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[\s-]/g, '');
}

export function Inventory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      // Inventory owns nothing by definition: load inventory rows first,
      // then fetch only the parts the user owns (catalogue + custom).
      const { data: invRows, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id);
      if (invErr) {
        if (cancelled) return;
        setError(invErr.message);
        return;
      }
      const rows = (invRows as Inventory[] | null) ?? [];
      const map: Record<string, Inventory> = {};
      for (const row of rows) map[row.part_id] = row;
      if (cancelled) return;
      setInventory(map);

      const partIds = rows.map((r) => r.part_id);
      if (partIds.length === 0) {
        setParts([]);
        return;
      }
      // Fetch in batches of 200 to avoid URL length limits.
      const fetched: Part[] = [];
      for (let i = 0; i < partIds.length; i += 200) {
        const slice = partIds.slice(i, i + 200);
        const { data: partRows, error: partErr } = await supabase
          .from('parts')
          .select('*')
          .in('id', slice)
          .order('display_name');
        if (partErr) {
          if (cancelled) return;
          setError(partErr.message);
          return;
        }
        for (const p of (partRows as Part[] | null) ?? []) fetched.push(p);
      }
      if (cancelled) return;
      setParts(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const ownedParts = useMemo(() => {
    if (!parts) return null;
    const list = parts.filter((p) => inventory[p.id]);
    if (classFilter !== 'all') {
      const filtered = list.filter((p) => p.part_class === classFilter);
      return filtered;
    }
    return list;
  }, [parts, inventory, classFilter]);

  const filtered = useMemo(() => {
    if (!ownedParts) return [];
    const q = normalizeQuery(query);
    return ownedParts.filter((p) => {
      if (sourceFilter === CUSTOM_ONLY && p.owner_id == null) return false;
      if (sourceFilter === CATALOGUE_ONLY && p.owner_id != null) return false;
      if (q) {
        const terms = p.search_terms ?? [];
        const hit = terms.some((t) => t.includes(q)) ||
          p.display_name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [ownedParts, sourceFilter, query]);

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

  async function updateQuantity(part: Part, delta: number) {
    if (!user) return;
    const inv = inventory[part.id];
    if (!inv) return;
    const nextQty = inv.quantity + delta;
    if (nextQty <= 0) {
      await removeOne(part);
      return;
    }
    const { data, error: err } = await supabase
      .from('inventory')
      .update({ quantity: nextQty })
      .eq('user_id', user.id)
      .eq('part_id', part.id)
      .select('*')
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setInventory((prev) => ({ ...prev, [part.id]: data as Inventory }));
  }

  async function removeOne(part: Part) {
    if (!user) return;
    const inv = inventory[part.id];
    if (!inv) return;
    const ok =
      inv.quantity > 1
        ? window.confirm(
            `Remove all ${inv.quantity} of ${part.display_name} from your inventory?`,
          )
        : true;
    if (!ok) return;
    const { error: err } = await supabase
      .from('inventory')
      .delete()
      .eq('user_id', user.id)
      .eq('part_id', part.id);
    if (err) {
      setError(err.message);
      return;
    }
    setInventory((prev) => {
      const next = { ...prev };
      delete next[part.id];
      return next;
    });
    // If the row was a custom part with no remaining references, drop it too.
    if (part.owner_id != null) {
      await supabase.from('parts').delete().eq('id', part.id);
    }
  }

  // Bulk delete: remove selected parts from inventory (and custom rows).
  async function deleteSelected() {
    if (!user || selected.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    const ids = [...selected];
    const { error: err } = await supabase
      .from('inventory')
      .delete()
      .in('part_id', ids)
      .eq('user_id', user.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInventory((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    // Drop custom parts that no longer have inventory rows for this user.
    const customIds = ids.filter((id) => parts?.find((p) => p.id === id)?.owner_id != null);
    if (customIds.length > 0) {
      await supabase.from('parts').delete().in('id', customIds);
    }
    clearSelection();
  }

  // Send a selection to the builder: stash the selected part ids in session
  // storage so the Builder screen (a later stage) can pre-fill its slots.
  function sendToBuilder() {
    if (selected.size === 0) return;
    const ids = [...selected];
    sessionStorage.setItem('beybox:builder-prefill', JSON.stringify(ids));
    clearSelection();
    // Builder route is a later stage; navigate there when it exists.
    // For now we leave the user on Inventory after stashing.
  }

  const totalOwned = ownedParts?.length ?? 0;
  const customCount = ownedParts?.filter((p) => p.owner_id != null).length ?? 0;

  return (
    <>
      <div className="filters">
        <div className="find">
          <Search size={13} />
          <input
            placeholder="Search your inventory"
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
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          className="b accent"
          onClick={() => navigate('/inventory/add')}
        >
          <Plus size={13} />
          Add part
        </button>
      </div>

      {error && (
        <div className="note form-error" style={{ margin: '12px 18px 0' }}>
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div className="selbar">
          <span className="count">{selected.size} selected</span>
          <div className="slots" />
          <button className="b" onClick={clearSelection}>
            Deselect
          </button>
          <button className="b" onClick={sendToBuilder}>
            Send to builder
          </button>
          <button className="b del" onClick={deleteSelected} disabled={busy}>
            <Trash2 size={13} />
            Delete
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
              variant="inventory"
              selected={selected.has(part.id)}
              owned
              onSelect={() => toggleSelect(part.id)}
              onOwn={() => removeOne(part)}
              quantity={inv?.quantity ?? 1}
              onIncrement={() => updateQuantity(part, +1)}
              onDecrement={() => updateQuantity(part, -1)}
              onDelete={() => removeOne(part)}
              onEdit={() => navigate(`/inventory/edit/${part.id}`)}
            />
          );
        })}
      </div>

      {ownedParts && totalOwned === 0 && (
        <div className="empty">
          <div className="empty-eyebrow">Inventory</div>
          <div className="empty-title">
            You haven't added any parts yet
          </div>
          <div className="empty-body">
            Mark parts as owned from Explore, or add a part the catalogue doesn't have.
          </div>
          <button className="b go" onClick={() => navigate('/inventory/add')}>
            <Plus size={13} />
            Add a part
          </button>
        </div>
      )}

      {ownedParts && totalOwned > 0 && filtered.length === 0 && (
        <div className="empty">
          <div className="empty-title">No parts match your search</div>
        </div>
      )}

      <div className="foot">
        <div className="foot-l">
          <span>
            {totalOwned} part{totalOwned === 1 ? '' : 's'}
            {customCount > 0 ? ` · ${customCount} custom` : ''}
          </span>
        </div>
        <div className="foot-r" />
      </div>
    </>
  );
}
