import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, ArrowRightLeft, FolderPlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  loadBuilds,
  loadDecks,
  createDeck,
  setDeckSlot,
  errorMessage,
  type DeckWithBuilds,
  type BuildWithParts,
} from '@/lib/buildData';

type Props = {
  build: BuildWithParts;
  onClose: () => void;
  onDeckChanged: () => void;
};

export function AddToDeckSheet({ build, onClose, onDeckChanged }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckWithBuilds[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const builds = await loadBuilds(user.id);
        const list = await loadDecks(user.id, builds);
        if (!cancelled) setDecks(list);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  function firstEmptyPosition(deck: DeckWithBuilds): number | null {
    for (let i = 0; i < deck.slots.length; i++) {
      if (!deck.slots[i]) return i + 1;
    }
    return null;
  }

  function buildIsInDeck(deck: DeckWithBuilds): boolean {
    return deck.slots.some((s) => s?.buildId === build.buildId);
  }

  async function addToEmpty(deck: DeckWithBuilds, position: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setDeckSlot(deck.id, build.buildId, position);
      await refresh();
      onDeckChanged();
    } catch (e) {
      const msg = errorMessage(e);
      setError(/duplicate|unique|violates|already/i.test(msg) ? 'That Bey is already in this deck.' : msg);
    } finally {
      setBusy(false);
    }
  }

  async function swapInto(deck: DeckWithBuilds, position: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setDeckSlot(deck.id, build.buildId, position);
      await refresh();
      onDeckChanged();
    } catch (e) {
      const msg = errorMessage(e);
      setError(/duplicate|unique|violates|already/i.test(msg) ? 'That Bey is already in this deck.' : msg);
    } finally {
      setBusy(false);
    }
  }

  async function createNewDeckWithBey() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = newDeckName.trim() || `${build.name} deck`;
      const deck = await createDeck(user.id, name);
      await setDeckSlot(deck.id, build.buildId, 1);
      onClose();
      navigate(`/decks/${deck.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-label="Add to deck">
        <div className="sheet-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Add to deck</div>
            <div className="sheet-title">{build.name}</div>
          </div>
          <button className="b grey icon" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {error && (
          <div className="note form-error" style={{ margin: '0 18px 12px' }}>{error}</div>
        )}

        <div className="sheet-body">
          {decks === null ? (
            <div style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 12, padding: '12px 18px' }}>
              Loading your decks…
            </div>
          ) : decks.length === 0 ? (
            <div className="sheet-empty">
              You have no decks yet. Create one below with this Bey.
            </div>
          ) : (
            <ul className="sheet-decks">
              {decks.map((deck) => {
                const empty = firstEmptyPosition(deck);
                const alreadyIn = buildIsInDeck(deck);
                const full = empty === null;
                return (
                  <li key={deck.id} className="sheet-deck">
                    <button
                      className="sheet-deck-main"
                      onClick={() => navigate(`/decks/${deck.id}`)}
                    >
                      <span className="sheet-deck-name">{deck.name}</span>
                      <span className="sheet-deck-state">
                        {alreadyIn
                          ? 'This Bey is already in this deck'
                          : full
                            ? 'Full — swap into a slot'
                            : `${deck.slots.filter((s) => s).length}/3 · room to add`}
                      </span>
                      <span className="sheet-slots-mini">
                        {deck.slots.map((s, i) => (
                          <i key={i} className={s ? 'filled' : 'empty'} />
                        ))}
                      </span>
                    </button>
                    {alreadyIn ? (
                      <button className="b sm" onClick={() => navigate(`/decks/${deck.id}`)}>
                        Open
                      </button>
                    ) : full ? (
                      <div className="swap-options">
                        {deck.slots.map((s, i) => (
                          <button
                            key={i}
                            className="b sm"
                            onClick={() => swapInto(deck, i + 1)}
                            disabled={busy}
                            title={`Swap with ${s?.name ?? `slot ${i + 1}`}`}
                          >
                            <ArrowRightLeft size={11} />
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        className="b sm go"
                        onClick={() => addToEmpty(deck, empty!)}
                        disabled={busy}
                      >
                        <Plus size={11} />
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="sheet-new">
            <div className="eyebrow" style={{ marginBottom: 8 }}>New deck with this Bey</div>
            <div className="sheet-new-row">
              <input
                className="sheet-input"
                value={newDeckName}
                placeholder={`${build.name} deck`}
                onChange={(e) => setNewDeckName(e.target.value)}
                aria-label="New deck name"
              />
              <button className="b accent" onClick={createNewDeckWithBey} disabled={busy}>
                <FolderPlus size={12} />
                Create
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
