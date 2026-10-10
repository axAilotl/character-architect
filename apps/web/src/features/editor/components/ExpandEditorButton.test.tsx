import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ExpandEditorButton } from './ExpandEditorButton';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

function Field({ singleLine = false }: { singleLine?: boolean }) {
  const [value, setValue] = useState('Existing description');
  return <><textarea aria-label="Inline field" value={value} onChange={event => setValue(event.target.value)} />
    <ExpandEditorButton label="Description" value={value} onChange={setValue} singleLine={singleLine} maxLength={2000} /></>;
}

describe('expanded standard editor', () => {
  it('shares edits with the inline field and keeps them when dismissed', () => {
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Description' }));
    const editor = screen.getByRole('textbox', { name: 'Description', exact: true });
    expect(editor).toHaveValue('Existing description');
    fireEvent.change(editor, { target: { value: 'Updated\nlong description' } });
    expect(screen.getByRole('textbox', { name: 'Inline field' })).toHaveValue('Updated\nlong description');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Description' }));
    expect(screen.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Updated\nlong description');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Inline field' })).toHaveValue('Updated\nlong description');
  });

  it('preserves single-line input behavior and length constraints', () => {
    render(<Field singleLine />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Description' }));
    const editor = screen.getByRole('textbox', { name: 'Description', exact: true });
    expect(editor).toHaveAttribute('maxlength', '2000');
    fireEvent.change(editor, { target: { value: 'Single\nline' } });
    expect(screen.getByRole('textbox', { name: 'Inline field' })).toHaveValue('Singleline');
  });
});
