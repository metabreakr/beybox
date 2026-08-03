import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Trash2, FolderOpen } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  loadBuilds,
  loadDecks,
  duplicateDeck,
  errorMessage,
  type DeckWithBuilds,
} from '@/lib/buildData';
import { evaluateDeck } from '@/lib/deckRules';
import { typeColor, typeLabel } from '@/components/PartCard';
import { PartThumb } from '@/lib/partImage';

const ARCH_LABELS: { key: 'attack' | 'defense' | 'stamina' | 'balance'; label: string }[] = [
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'balance', label: 'Balance' },
];

export function Decks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckWithBuilds[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  async function refresh() {
    if (!user) return;
    try {
      const builds = await loadBuilds(user.id);
      const list = await loadDecks(user.id, builds);
      setDecks(list);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  useEffect(() => {
    refresh();
  }, [user]);

  async function handleCreate() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = newName.trim() || `Deck ${(decks?.length ?? 0) + 1}`;
      const { data, error: err } = await supabase
        .from('decks')
        .insert({ user_id: user.id, name })
        .select('*')
        .single();
      if (err) throw err;
      setNewName('');
      await refresh();
      navigate(`/decks/${(data as { id: string }).id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(deck: DeckWithBuilds) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await duplicateDeck(user.id, deck);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(deck: DeckWithBuilds) {
    if (busy) return;
    const ok = window.confirm(`Delete ${deck.name}? Its Beys are not deleted.`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('decks').delete().eq('id', deck.id);
      if (err) throw err;
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && decks === null) {
    return <div className="note form-error" style={{ margin: '16px 18px' }}>{error}</div>;
  }

  return (
    <>
      <div className="filters">
        <div className="find" style={{ flex: 0 }}>
          <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text)', paddingLeft: 4 }}>
            Decks
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <input
          className="sheet-input"
          style={{ width: 180 }}
          value={newName}
          placeholder="New deck name"
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New deck name"
        />
        <button className="b go" onClick={handleCreate} disabled={busy}>
          <Plus size={13} />
          New deck
        </button>
      </div>

      {error && (
        <div className="note form-error" style={{ margin: '12px 18px 0' }}>{error}</div>
      )}

      {decks !== null && decks.length === 0 && (
        <div className="empty">
          <div className="empty-eyebrow">Decks</div>
          <div className="empty-title">No decks yet</div>
          <div className="empty-body">
            Create a deck above, then add Beys from your Collection to fill its three slots.
          </div>
        </div>
      )}

      <div className="deckgrid">
        {decks?.map((deck) => {
          const status = evaluateDeck(deck.slots);
          const cls = status.legal && status.filledCount === 3
            ? 'legal'
            : status.filledCount === 0
              ? ''
              : 'notlegal';
          return (
            <div key={deck.id} className={`deck-card ${cls}`}>
              <div className="deck-card-head">
                <div className="deck-card-name">{deck.name}</div>
                <div className="deck-card-status">
                  <span className={`dot ${status.legal && status.filledCount === 3 ? 'ok' : status.filledCount === 0 ? 'dim' : 'warn'}`} />
                  {status.legal && status.filledCount === 3
                    ? 'WBO legal'
                    : status.filledCount === 0
                      ? 'Empty'
                      : `${status.issues.length} issue${status.issues.length === 1 ? '' : 's'}`}
                </div>
              </div>

              <div className="deck-slots">
                {deck.slots.map((slot, i) => (
                  <div key={i} className={`deck-slot${slot ? '' : ' empty'}`}>
                    {slot ? (
                      <>
                        <span className="deck-slot-thumb">
                          <PartThumb image={slot.blade?.image ?? null} partClass="blade" type={slot.blade?.type ?? null} banned={slot.blade?.banned ?? false} />
                        </span>
                        <span className="deck-slot-name">{slot.name}</span>
                        {slot.blade?.type && (
                          <span
                            className="deck-slot-type"
                            style={{ color: typeColor(slot.blade.type) }}
                          >
                            {typeLabel(slot.blade.type)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>Slot {i + 1} — empty</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="deck-card-foot">
                <div className="deck-coverage">
                  {ARCH_LABELS.map((a) => {
                    const active = status.coverage.types.includes(a.key);
                    return (
                      <span
                        key={a.key}
                        className={`cov-chip${active ? ' active' : ''}`}
                        style={active ? { color: typeColor(a.key) } : undefined}
                      >
                        {a.label}
                      </span>
                    );
                  })}
                </div>
                {status.coverage.allSameType && status.coverage.types.length === 1 && (
                  <div className="deck-card-status" style={{ color: 'var(--warn)' }}>
                    All three Beys share one type
                  </div>
                )}
                <div className="deck-card-actions">
                  <button className="b sm" onClick={() => navigate(`/decks/${deck.id}`)}>
                    <FolderOpen size={11} />
                    Open
                  </button>
                  <button className="b sm" onClick={() => handleDuplicate(deck)} disabled={busy}>
                    <Copy size={11} />
                    Duplicate
                  </button>
                  <button className="b sm del" onClick={() => handleDelete(deck)} disabled={busy}>
                    <Trash2 size={11} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="foot">
        <div className="foot-l">
          <span>{decks?.length ?? 0} decks</span>
        </div>
        <div className="foot-r" />
      </div>
    </>
  );
}
