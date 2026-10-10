import { useEffect, useRef, useState } from 'react';
import type { Card } from '../../lib/types';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { getDeploymentConfig } from '../../config/deployment';

export function FavoriteButton({
  card,
  onChange,
  className = 'btn-secondary',
}: {
  card: Card;
  onChange?: (favorite: boolean) => void;
  className?: string;
}) {
  const [favorite, setFavorite] = useState(!!card.meta.favorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    setFavorite(!!card.meta.favorite);
  }, [card.meta.id, card.meta.favorite]);
  // Refresh the star without replacing unsaved editor data.
  useEffect(() => {
    if (getDeploymentConfig().mode !== 'full') return;
    let cancelled = false;
    const refresh = async () => {
      const startedAt = revision.current;
      const result = await api.getFavorite(card.meta.id);
      if (!cancelled && result.data && startedAt === revision.current) {
        setFavorite(result.data.favorite);
        onChangeRef.current?.(result.data.favorite);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [card.meta.id]);
  async function toggle() {
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      let next = !favorite;
      if (getDeploymentConfig().mode === 'full') {
        const result = await api.setFavorite(card.meta.id, next);
        if (result.error || !result.data)
          throw new Error(result.error || 'Favorite could not be saved');
        next = result.data.favorite;
      } else {
        const current = (await localDB.getCard(card.meta.id)) || card;
        await localDB.saveCard({ ...current, meta: { ...current.meta, favorite: next } });
      }
      setFavorite(next);
      onChange?.(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Favorite could not be saved');
    } finally {
      revision.current += 1;
      setBusy(false);
    }
  }
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={className}
        aria-pressed={favorite}
        aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
        title={favorite ? 'Remove favorite' : 'Add favorite'}
        disabled={busy}
        onClick={toggle}
      >
        {favorite ? '★' : '☆'}
      </button>
      {error && (
        <span role="alert" className="text-red-400 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
