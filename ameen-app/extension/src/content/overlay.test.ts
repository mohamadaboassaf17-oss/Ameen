import { AutofillOverlay } from './overlay';
import type { DesktopVaultItem } from '../shared/messages';

function makeItem(overrides: Partial<DesktopVaultItem> = {}): DesktopVaultItem {
  return {
    id: '1',
    type: 'login',
    title: 'Example',
    username: 'user@example.com',
    password: '',
    url: '',
    content: '',
    cardholder: '',
    number: '',
    expiry: '',
    cvv: '',
    notes: '',
    otpSecret: '',
    updatedAt: '',
    isConflict: false,
    ...overrides,
  };
}

function makeRect(
  overrides: Partial<DOMRect> = {}
): DOMRect {
  return {
    x: 100,
    y: 200,
    width: 300,
    height: 40,
    top: 200,
    right: 400,
    bottom: 240,
    left: 100,
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('AutofillOverlay', () => {
  let overlay: AutofillOverlay;

  beforeEach(() => {
    overlay = new AutofillOverlay();
    vi.useFakeTimers();
  });

  afterEach(() => {
    overlay.destroy();
    vi.useRealTimers();
  });

  it('creates overlay container in document body', () => {
    const items = [makeItem({ title: 'GitHub' })];
    overlay.show(items, makeRect());

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).not.toBeNull();
    expect(container!.parentElement).toBe(document.body);
  });

  it('creates correct structure with avatar, title, and username', () => {
    const items = [makeItem({ title: 'GitHub', username: 'octocat' })];
    overlay.show(items, makeRect());

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).not.toBeNull();
    expect(container!.textContent).toContain('G');
    expect(container!.textContent).toContain('GitHub');
    expect(container!.textContent).toContain('octocat');
  });

  it('positions overlay relative to target element rect', () => {
    const items = [makeItem({ title: 'GitHub' })];
    overlay.show(items, makeRect({ bottom: 240, left: 100, width: 300 }));

    const container = document.querySelector(
      '[data-ameen-overlay]'
    ) as HTMLDivElement;
    expect(container).not.toBeNull();
    expect(container.style.position).toBe('absolute');
    expect(container.style.top).toBe('244px');
    expect(container.style.left).toBe('100px');
  });

  it('sets high z-index for overlay', () => {
    const items = [makeItem()];
    overlay.show(items, makeRect());

    const container = document.querySelector(
      '[data-ameen-overlay]'
    ) as HTMLDivElement;
    expect(container.style.zIndex).toBe('2147483647');
  });

  it('hides overlay when hide() is called', () => {
    const items = [makeItem()];
    overlay.show(items, makeRect());

    overlay.hide();

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });

  it('does nothing when show() called with empty items', () => {
    overlay.show([], makeRect());

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });

  it('calls onSelect callback when item is clicked', () => {
    const items = [makeItem({ title: 'GitHub' })];
    overlay.show(items, makeRect());

    let selected: DesktopVaultItem | undefined;
    overlay.onSelect((item) => {
      selected = item;
    });

    const row = document.querySelector('[data-ameen-overlay] > div')!;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selected).toBeDefined();
    expect(selected!.title).toBe('GitHub');
  });

  it('hides overlay after item selection', () => {
    const items = [makeItem()];
    overlay.show(items, makeRect());

    overlay.onSelect(() => {});
    const row = document.querySelector('[data-ameen-overlay] > div')!;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });

  it('navigates items with ArrowDown and ArrowUp keys', () => {
    const items = [
      makeItem({ id: '1', title: 'A' }),
      makeItem({ id: '2', title: 'B' }),
    ];
    overlay.show(items, makeRect());

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });

  it('hides overlay on Escape key', () => {
    const items = [makeItem()];
    overlay.show(items, makeRect());

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });

  it('shows em-dash for empty username', () => {
    const items = [makeItem({ title: 'NoUser', username: '' })];
    overlay.show(items, makeRect());

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container!.textContent).toContain('—');
  });

  it('limits visible items to 5', () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeItem({ id: String(i), title: `Item ${i}` })
    );
    overlay.show(items, makeRect());

    const container = document.querySelector('[data-ameen-overlay]')!;
    const scrollContainer = container.firstElementChild;
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer!.children.length).toBe(5);
  });

  it('destroy cleans up everything', () => {
    const items = [makeItem()];
    overlay.show(items, makeRect());

    overlay.destroy();

    const container = document.querySelector('[data-ameen-overlay]');
    expect(container).toBeNull();
  });
});
