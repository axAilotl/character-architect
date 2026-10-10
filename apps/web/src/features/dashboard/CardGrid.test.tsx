import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../lib/types';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { CardGrid } from './CardGrid';

const deployment = vi.hoisted(() => ({ mode: 'full' }));
vi.mock('../../config/deployment', () => ({ getDeploymentConfig: () => deployment }));
vi.mock('../../lib/api', () => ({ api: { listCards: vi.fn(), deleteCard: vi.fn() } }));
vi.mock('../../lib/db', () => ({ localDB: { listCards: vi.fn(), getImage: vi.fn() } }));
vi.mock('../../components/shared/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('@character-foundry/character-foundry/tokenizers', () => ({ registry: { get: () => ({ count: () => 0 }) } }));
vi.mock('./CardItem', () => ({
  CardSkeleton: () => <div>Loading card</div>,
  CardItem: ({ card, onFavoriteChange }: { card: Card; onFavoriteChange: (id: string, favorite: boolean) => void }) => (
    <article><h3>{card.meta.name}</h3><button onClick={() => onFavoriteChange(card.meta.id, false)}>Unstar {card.meta.name}</button></article>
  ),
}));

function card(name: string, description = '', tags: string[] = []): Card {
  return {
    meta: { id: name, name, spec: 'v2', tags, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    data: { name, description, personality: '', scenario: '', first_mes: '', mes_example: '' },
  };
}
const matches = [card('Needle 1'), card('Needle 2'), card('Needle 3'), card('Needle 4'), card('Description match', 'A needle'), card('Tag match', '', ['needle'])];

async function search(value: string) {
  fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value } });
  // Exercise the actual debounced request path.
  await act(() => new Promise(resolve => setTimeout(resolve, 350)));
}

beforeEach(() => {
  deployment.mode = 'full';
  vi.mocked(api.listCards).mockReset().mockResolvedValue({ data: { items: matches, total: 6 } });
  vi.mocked(localDB.listCards).mockReset().mockResolvedValue(matches);
  vi.mocked(localDB.getImage).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('library search results', () => {
  it('renders all six server matches, including description and tag matches', async () => {
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    await search('needle');
    expect(screen.getByText('6 cards (6 matching)')).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
  });

  it.each(['light', 'static'])('searches descriptions and tags locally in %s mode', async mode => {
    deployment.mode = mode;
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    await search(' NEEDLE ');
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    expect(api.listCards).not.toHaveBeenCalled();
  });

  it('shows an empty search with a way back to the library', async () => {
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    vi.mocked(api.listCards).mockResolvedValue({ data: { items: [], total: 0 } });
    await search('absent');
    expect(screen.getByRole('heading', { name: 'No matching cards' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Show All Cards' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Filter cards' })).toBeVisible();
  });

  it('ignores an older search response that arrives after the latest search', async () => {
    let finishOld!: (value: Awaited<ReturnType<typeof api.listCards>>) => void;
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    vi.mocked(api.listCards).mockImplementation(query => query === 'old'
      ? new Promise(resolve => { finishOld = resolve; })
      : Promise.resolve({ data: { items: [card('New match', 'new')], total: 1 } }));
    await search('old');
    await search('new');
    await screen.findByRole('heading', { name: 'New match' });
    await act(async () => finishOld({ data: { items: [card('Old match')], total: 99 } }));
    expect(screen.getByRole('heading', { name: 'New match' })).toBeVisible();
    expect(screen.queryByText(/99 cards/)).not.toBeInTheDocument();
  });

  it('resets the page and sends filters and sorting to the server', async () => {
    vi.mocked(api.listCards).mockResolvedValue({ data: { items: matches, total: 26 } });
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    fireEvent.click(screen.getByTitle('Next page'));
    await screen.findByText('Page 2 of 2');
    await search('needle');
    expect(screen.getByText('Page 1 of 2')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter cards' }), { target: { value: 'v3' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort cards' }), { target: { value: 'name' } });
    await waitFor(() => expect(api.listCards).toHaveBeenLastCalledWith('needle', 1, 20, false, { filter: 'v3', sort: 'name' }));
  });

  it('returns to the preceding page when the last favorite on a page is unstarred', async () => {
    vi.mocked(api.listCards).mockResolvedValue({ data: { items: matches, total: 21 } });
    render(<CardGrid onCardClick={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Description match' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter cards' }), { target: { value: 'favorites' } });
    await screen.findByRole('heading', { name: 'Description match' });
    fireEvent.click(screen.getByTitle('Next page'));
    await screen.findByRole('heading', { name: 'Description match' });
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    vi.mocked(api.listCards).mockImplementation((_query, page) => Promise.resolve({ data: { items: page === 1 ? matches : [], total: 20 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Unstar Description match' }));
    await screen.findByRole('heading', { name: 'Description match' });
    expect(api.listCards).toHaveBeenLastCalledWith('', 1, 20, true, { filter: 'favorites', sort: 'edited' });
    expect(screen.getByText('20 cards')).toBeVisible();
  });

  it('reports a failed search and lets the user retry the same query', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<CardGrid onCardClick={vi.fn()} />);
      await screen.findByRole('heading', { name: 'Description match' });
      vi.mocked(api.listCards).mockResolvedValue({ error: 'Connection unavailable' });
      await search('needle');
      expect(screen.getByRole('alert')).toHaveTextContent('Connection unavailable');
      expect(screen.queryByRole('heading', { name: 'No cards yet' })).not.toBeInTheDocument();
      vi.mocked(api.listCards).mockResolvedValue({ data: { items: matches, total: 6 } });
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
      await screen.findByRole('heading', { name: 'Description match' });
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
      expect(api.listCards).toHaveBeenLastCalledWith('needle', 1, 20, false, { filter: 'all', sort: 'edited' });
    } finally {
      errorLog.mockRestore();
    }
  });
});
