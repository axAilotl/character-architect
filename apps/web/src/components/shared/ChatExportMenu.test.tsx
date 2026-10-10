import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatExportMenu } from './ChatExportMenu';

afterEach(cleanup);

describe('chat destinations', () => {
  it('hides the action when no chat modules are enabled', () => {
    render(<ChatExportMenu />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['Lumiverse', 'SillyTavern'])('sends directly when only %s is enabled', async label => {
    const send = vi.fn(async () => {});
    render(<ChatExportMenu {...(label === 'Lumiverse' ? { onLumiverse: send } : { onSillyTavern: send })} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers both destinations and supports keyboard navigation', async () => {
    const lumi = vi.fn(async () => {});
    const silly = vi.fn(async () => {});
    render(<ChatExportMenu onLumiverse={lumi} onSillyTavern={silly} />);
    fireEvent.click(screen.getByRole('button', { name: /Chat Export/ }));
    expect(screen.getByRole('menuitem', { name: 'Lumiverse' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'SillyTavern' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: 'SillyTavern' }));
    await waitFor(() => expect(silly).toHaveBeenCalledOnce());
    expect(lumi).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('prevents repeated sends until the pending request completes', async () => {
    let finish!: () => void;
    const send = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<ChatExportMenu onLumiverse={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lumiverse' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lumiverse' })).toBeEnabled());
    expect(send).toHaveBeenCalledOnce();
  });
});
