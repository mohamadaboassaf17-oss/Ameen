import { DesktopVaultItem } from '../shared/messages';

type SelectCallback = (item: DesktopVaultItem) => void;

interface OverlayRow {
  element: HTMLDivElement;
  item: DesktopVaultItem;
}

const STYLES = `
  --ameen-bg: #181822;
  --ameen-border: #2e2e3d;
  --ameen-text: #e8e8f0;
  --ameen-text-secondary: #9d9db0;
  --ameen-primary: #a78bfa;
  --ameen-primary-bg: rgba(167, 139, 250, 0.12);
  --ameen-hover: #232338;
  --ameen-active: rgba(167, 139, 250, 0.18);
`;

const BASE_STYLE = `
  direction: rtl;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  background: var(--ameen-bg);
  border: 1px solid var(--ameen-border);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.48);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
  padding: 4px 0;
`;

const ITEM_STYLE = `
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  color: var(--ameen-text);
  cursor: pointer;
  transition: background 0.1s;
`;

const ITEM_HOVER_STYLE = `
  background: var(--ameen-hover);
`;

const ITEM_ACTIVE_STYLE = `
  background: var(--ameen-active);
`;

const AVATAR_STYLE = `
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
  color: #fff;
`;

const META_STYLE = `
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const TITLE_STYLE = `
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ameen-text);
`;

const USERNAME_STYLE = `
  font-size: 12px;
  color: var(--ameen-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

function getAvatarColor(title: string): string {
  const colors = [
    '#a78bfa', '#60a5fa', '#34d399', '#f472b6',
    '#fbbf24', '#fb7185', '#38bdf8', '#a3e635',
    '#c084fc', '#f97316',
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export class AutofillOverlay {
  private container: HTMLDivElement | null = null;
  private rows: OverlayRow[] = [];
  private activeIndex = -1;
  private callback: SelectCallback | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundDocClick: ((e: MouseEvent) => void) | null = null;

  show(items: DesktopVaultItem[], fieldRect: DOMRect): void {
    this.destroy();
    if (items.length === 0) return;

    this.container = document.createElement('div');
    this.container.setAttribute('data-ameen-overlay', 'true');
    this.container.dir = 'rtl';
    this.container.style.cssText = `${STYLES} ${BASE_STYLE}`;

    const visibleItems = items.slice(0, 5);
    const scrollContainer: HTMLDivElement | null = null;

    for (const item of visibleItems) {
      const row = document.createElement('div');
      row.style.cssText = ITEM_STYLE;

      const initial = item.title.charAt(0).toUpperCase();
      const avatarColor = getAvatarColor(item.title);

      const avatar = document.createElement('div');
      avatar.style.cssText = `${AVATAR_STYLE} background: ${avatarColor};`;
      avatar.textContent = initial;

      const meta = document.createElement('div');
      meta.style.cssText = META_STYLE;

      const titleEl = document.createElement('div');
      titleEl.style.cssText = TITLE_STYLE;
      titleEl.textContent = item.title;

      const usernameEl = document.createElement('div');
      usernameEl.style.cssText = USERNAME_STYLE;
      usernameEl.textContent = item.username || '—';

      meta.appendChild(titleEl);
      meta.appendChild(usernameEl);
      row.appendChild(avatar);
      row.appendChild(meta);

      row.addEventListener('mouseenter', () => {
        this.clearHighlight();
        row.style.cssText += ITEM_HOVER_STYLE;
      });
      row.addEventListener('mouseleave', () => {
        row.style.cssText = ITEM_STYLE;
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callback) {
          this.callback(item);
        }
        this.hide();
      });

      this.container!.appendChild(row);
      this.rows.push({ element: row, item });
    }

    if (items.length > 5) {
      const scrollWrap = document.createElement('div');
      scrollWrap.style.cssText = 'max-height: 280px; overflow-y: auto;';
      while (this.container.firstChild) {
        scrollWrap.appendChild(this.container.firstChild);
      }
      this.container.appendChild(scrollWrap);
    }

    document.body.appendChild(this.container);

    const top = fieldRect.bottom + window.scrollY;
    const left = fieldRect.left + window.scrollX;
    const width = Math.max(fieldRect.width, 300);

    this.container.style.position = 'absolute';
    this.container.style.top = `${top + 4}px`;
    this.container.style.left = `${left}px`;
    this.container.style.width = `${width}px`;
    this.container.style.zIndex = '2147483647';

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundDocClick = this.handleDocClick.bind(this);
    document.addEventListener('keydown', this.boundKeyDown, true);
    setTimeout(() => {
      document.addEventListener('click', this.boundDocClick!, true);
    }, 0);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.container) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.moveHighlight(-1);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        this.selectActive();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        break;
    }
  }

  private handleDocClick(_e: MouseEvent): void {
    this.hide();
  }

  private moveHighlight(delta: number): void {
    if (this.rows.length === 0) return;
    this.clearHighlight();
    this.activeIndex = (this.activeIndex + delta + this.rows.length) % this.rows.length;
    const row = this.rows[this.activeIndex];
    if (row) {
      row.element.style.cssText = ITEM_STYLE + ITEM_ACTIVE_STYLE;
    }
  }

  private clearHighlight(): void {
    for (const row of this.rows) {
      row.element.style.cssText = ITEM_STYLE;
    }
  }

  private selectActive(): void {
    if (this.activeIndex >= 0 && this.activeIndex < this.rows.length) {
      const row = this.rows[this.activeIndex];
      if (row && this.callback) {
        this.callback(row.item);
      }
    }
    this.hide();
  }

  hide(): void {
    if (this.boundKeyDown) {
      document.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }
    if (this.boundDocClick) {
      document.removeEventListener('click', this.boundDocClick, true);
      this.boundDocClick = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.rows = [];
    this.activeIndex = -1;
  }

  onSelect(callback: SelectCallback): void {
    this.callback = callback;
  }

  destroy(): void {
    this.hide();
    this.callback = null;
  }
}
