import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from './FavoriteButton';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { getDeploymentConfig } from '../../config/deployment';
import type { Card } from '../../lib/types';

vi.mock('../../lib/api', () => ({ api: { getFavorite: vi.fn(), setFavorite: vi.fn() } }));
vi.mock('../../lib/db', () => ({ localDB: { getCard: vi.fn(), saveCard: vi.fn() } }));
vi.mock('../../config/deployment', () => ({ getDeploymentConfig: vi.fn() }));

const card: Card = {
  meta: { id: 'card', name: 'Test', spec: 'v2', tags: [], createdAt: '', updatedAt: '' },
  data: {
    name: 'Test',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
  },
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('local favorites', () => {
  it('saves in static mode without an API and keeps the latest stored card data', async () => {
    vi.mocked(getDeploymentConfig).mockReturnValue({ mode: 'static' } as ReturnType<
      typeof getDeploymentConfig
    >);
    vi.mocked(localDB.getCard).mockResolvedValue({
      ...card,
      data: { ...card.data, description: 'Newer stored edit' },
    });
    render(<FavoriteButton card={card} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add favorite' }));
    await waitFor(() =>
      expect(localDB.saveCard).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ favorite: true }),
          data: expect.objectContaining({ description: 'Newer stored edit' }),
        })
      )
    );
    expect(api.setFavorite).not.toHaveBeenCalled();
    expect(api.getFavorite).not.toHaveBeenCalled();
  });
  it('keeps the star unchanged when the local server cannot save it', async () => {
    vi.mocked(getDeploymentConfig).mockReturnValue({ mode: 'full' } as ReturnType<
      typeof getDeploymentConfig
    >);
    vi.mocked(api.getFavorite).mockResolvedValue({
      data: { favorite: false, updatedAt: 0, changeId: '' },
    });
    vi.mocked(api.setFavorite).mockResolvedValue({ error: 'Server unavailable' });
    render(<FavoriteButton card={card} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add favorite' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable'));
    expect(screen.getByRole('button', { name: 'Add favorite' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
