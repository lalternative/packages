type FeedbackType = 'bug' | 'idea' | 'other';

type Labels = {
  title: string;
  send: string;
  sending: string;
  close: string;
  bug: string;
  idea: string;
  other: string;
  placeholder: string;
  thanks: string;
  capture: string;
  capturing: string;
  remove_screenshot: string;
};

const DEFAULT_LABELS: Labels = {
  title: 'Feedback',
  send: 'Envoyer',
  sending: 'Envoi…',
  close: 'Fermer',
  bug: 'Bug',
  idea: 'Idée',
  other: 'Autre',
  placeholder: 'Décrivez votre retour…',
  thanks: 'Merci pour votre retour !',
  capture: 'Capturer l’écran',
  capturing: 'Capture…',
  remove_screenshot: 'Retirer la capture',
};

const STYLES = `
  :host {
    all: initial;
    font-family: system-ui, -apple-system, sans-serif;
    --skalpai-bg: #ffffff;
    --skalpai-fg: #111111;
    --skalpai-panel: #ffffff;
    --skalpai-input: #ffffff;
    --skalpai-border: rgba(0,0,0,.1);
    --skalpai-border-soft: rgba(0,0,0,.06);
    --skalpai-muted: rgba(0,0,0,.4);
    --skalpai-muted-soft: rgba(0,0,0,.06);
    --skalpai-muted-soft-hover: rgba(0,0,0,.1);
    --skalpai-accent: #7c3aed;
    --skalpai-disabled: rgba(0,0,0,.08);
    --skalpai-disabled-fg: rgba(0,0,0,.35);
  }
  :host([data-theme="dark"]) {
    --skalpai-bg: #1a1a1a;
    --skalpai-fg: #f5f5f5;
    --skalpai-panel: #1f1f1f;
    --skalpai-input: #2a2a2a;
    --skalpai-border: rgba(255,255,255,.08);
    --skalpai-border-soft: rgba(255,255,255,.05);
    --skalpai-muted: rgba(255,255,255,.45);
    --skalpai-muted-soft: rgba(255,255,255,.06);
    --skalpai-muted-soft-hover: rgba(255,255,255,.1);
    --skalpai-disabled: rgba(255,255,255,.08);
    --skalpai-disabled-fg: rgba(255,255,255,.35);
  }
  *, *::before, *::after { box-sizing: border-box; }
  .btn-fab {
    position: fixed; bottom: 16px; left: 16px; z-index: 2147483646;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 14px; border: 0; border-radius: 999px;
    background: var(--skalpai-fg); color: var(--skalpai-bg);
    font-size: 13px; font-weight: 500; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,.25);
    transition: opacity .15s;
  }
  .btn-fab:hover { opacity: .9; }
  .panel {
    position: fixed; bottom: 64px; left: 16px; z-index: 2147483647;
    width: 320px; max-width: calc(100vw - 32px);
    background: var(--skalpai-panel); color: var(--skalpai-fg);
    border: 1px solid var(--skalpai-border); border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,.35); overflow: hidden;
  }
  .head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--skalpai-border-soft);
    font-size: 14px; font-weight: 500;
  }
  .close {
    background: none; border: 0; cursor: pointer; font-size: 18px;
    color: var(--skalpai-muted); padding: 2px 8px; border-radius: 4px; line-height: 1;
  }
  .close:hover { background: var(--skalpai-muted-soft); color: var(--skalpai-fg); }
  .body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
  .types { display: flex; gap: 6px; }
  .type {
    flex: 0 0 auto; padding: 6px 14px; border: 0; border-radius: 8px;
    background: var(--skalpai-muted-soft); color: var(--skalpai-fg);
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: background .15s;
  }
  .type:hover { background: var(--skalpai-muted-soft-hover); }
  .type[aria-pressed="true"] { background: var(--skalpai-fg); color: var(--skalpai-bg); }
  textarea {
    width: 100%; min-height: 90px; padding: 10px 12px;
    border: 1px solid var(--skalpai-border); border-radius: 8px;
    font: inherit; font-size: 13px; resize: vertical;
    background: var(--skalpai-input); color: var(--skalpai-fg);
  }
  textarea::placeholder { color: var(--skalpai-muted); }
  textarea:focus {
    outline: 2px solid var(--skalpai-accent);
    outline-offset: -1px; border-color: transparent;
  }
  .meta { font-size: 11px; color: var(--skalpai-muted); word-break: break-all; line-height: 1.5; }
  .capture-row { display: flex; align-items: center; gap: 8px; }
  .capture-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; border: 1px solid var(--skalpai-border); border-radius: 8px;
    background: transparent; color: var(--skalpai-fg); font-size: 12px; cursor: pointer;
    transition: background .15s;
  }
  .capture-btn:hover { background: var(--skalpai-muted-soft); }
  .capture-btn:disabled { opacity: .5; cursor: not-allowed; }
  .preview {
    position: relative; display: inline-block;
    border: 1px solid var(--skalpai-border); border-radius: 8px; overflow: hidden;
  }
  .preview img { display: block; width: 64px; height: 48px; object-fit: cover; }
  .preview-remove {
    position: absolute; top: 2px; right: 2px;
    width: 18px; height: 18px; border-radius: 50%;
    border: 0; background: rgba(0,0,0,.7); color: #fff;
    font-size: 12px; line-height: 1; cursor: pointer; padding: 0;
  }
  .submit {
    width: 100%; padding: 10px; border: 0; border-radius: 8px;
    background: var(--skalpai-fg); color: var(--skalpai-bg);
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: opacity .15s;
  }
  .submit:hover:not(:disabled) { opacity: .9; }
  .submit:disabled {
    background: var(--skalpai-disabled); color: var(--skalpai-disabled-fg); cursor: not-allowed;
  }
  .err {
    padding: 8px 10px; background: rgba(239,68,68,.12); color: #f87171;
    font-size: 12px; border-radius: 6px;
  }
  .ok { padding: 28px 16px; text-align: center; font-size: 13px; color: var(--skalpai-muted); }
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

const HTMLElementCtor: typeof HTMLElement =
  typeof HTMLElement !== 'undefined'
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class SkalpaiFeedbackElement extends HTMLElementCtor {
  static observedAttributes = ['api-key', 'endpoint', 'project-id', 'labels', 'theme'];

  private root: ShadowRoot;
  private open = false;
  private type: FeedbackType = 'other';
  private message = '';
  private state: 'idle' | 'loading' | 'sent' | 'error' = 'idle';
  private errorMsg = '';
  private screenshot: string | null = null;
  private capturing = false;
  private themeObserver: MutationObserver | null = null;
  private mqlDark: MediaQueryList | null = null;

  /** Optional user identifier (email, user id, etc.) — set programmatically. */
  userIdentifier = '';

  get apiKey(): string {
    return this.getAttribute('api-key') ?? '';
  }
  set apiKey(v: string) {
    if (v) this.setAttribute('api-key', v);
    else this.removeAttribute('api-key');
  }

  get endpoint(): string {
    return this.getAttribute('endpoint') ?? '';
  }
  set endpoint(v: string) {
    if (v) this.setAttribute('endpoint', v);
    else this.removeAttribute('endpoint');
  }

  get projectId(): string {
    return this.getAttribute('project-id') ?? '';
  }
  set projectId(v: string) {
    if (v) this.setAttribute('project-id', v);
    else this.removeAttribute('project-id');
  }

  get labels(): Labels {
    const raw = this.getAttribute('labels');
    if (!raw) return DEFAULT_LABELS;
    try {
      return { ...DEFAULT_LABELS, ...(JSON.parse(raw) as Partial<Labels>) };
    } catch {
      return DEFAULT_LABELS;
    }
  }
  set labels(v: string | Partial<Labels>) {
    const json = typeof v === 'string' ? v : JSON.stringify(v);
    this.setAttribute('labels', json);
  }

  get theme(): 'light' | 'dark' | 'auto' {
    const v = this.getAttribute('theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  }
  set theme(v: 'light' | 'dark' | 'auto' | null) {
    if (v && v !== 'auto') this.setAttribute('theme', v);
    else this.removeAttribute('theme');
  }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.applyTheme();
    this.setupThemeWatchers();
    this.render();
    document.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKey);
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.mqlDark?.removeEventListener('change', this.applyTheme);
    this.mqlDark = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'theme') {
      this.applyTheme();
      return;
    }
    if (this.root.firstChild) this.render();
  }

  private detectHostTheme(): 'light' | 'dark' {
    const prop = this.getAttribute('theme');
    if (prop === 'light' || prop === 'dark') return prop;

    if (typeof document === 'undefined') return 'light';
    const html = document.documentElement;
    const body = document.body;

    // Tailwind / shadcn / HeadlessUI / Radix Themes / daisyUI / Nuxt
    if (html.classList.contains('dark') || body?.classList.contains('dark')) return 'dark';

    // Mantine
    const mantine = html.getAttribute('data-mantine-color-scheme');
    if (mantine === 'dark') return 'dark';
    if (mantine === 'light') return 'light';

    // Bootstrap 5.3+, daisyUI, Chakra, generic data-theme
    const dt = html.getAttribute('data-theme') || html.getAttribute('data-bs-theme');
    if (dt) {
      if (/dark|night|black/i.test(dt)) return 'dark';
      if (/light|day/i.test(dt)) return 'light';
    }

    // System fallback
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  private applyTheme = (): void => {
    const theme = this.detectHostTheme();
    if (this.getAttribute('data-theme') !== theme) {
      this.setAttribute('data-theme', theme);
    }
  };

  private setupThemeWatchers(): void {
    if (typeof window === 'undefined') return;
    this.themeObserver = new MutationObserver(() => this.applyTheme());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-bs-theme', 'data-mantine-color-scheme'],
    });
    if (document.body) {
      this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    this.mqlDark = matchMedia('(prefers-color-scheme: dark)');
    this.mqlDark.addEventListener('change', this.applyTheme);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      this.open = false;
      this.render();
    }
  };

  private async captureScreenshot(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    this.render();
    const prevDisplay = this.style.display;
    this.style.display = 'none';
    try {
      const html2canvasMod = await import('html2canvas-pro');
      const html2canvas = html2canvasMod.default;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = await html2canvas(document.body, {
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });
      this.screenshot = canvas.toDataURL('image/png');
    } catch (err) {
      this.errorMsg = err instanceof Error ? err.message : 'capture failed';
      this.state = 'error';
    } finally {
      this.style.display = prevDisplay;
      this.capturing = false;
      this.render();
    }
  }

  private async submit(): Promise<void> {
    if (!this.message.trim() || !this.endpoint || !this.projectId) {
      this.state = 'error';
      this.errorMsg = 'widget misconfigured';
      this.render();
      return;
    }
    this.state = 'loading';
    this.render();
    try {
      const url = `${this.endpoint.replace(/\/$/, '')}/api/projects/${encodeURIComponent(this.projectId)}/feedback`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          type: this.type,
          message: this.message,
          url: location.pathname,
          device: window.innerWidth < 768 ? 'mobile' : 'desktop',
          user_identifier: this.userIdentifier,
          ...(this.screenshot ? { screenshot: this.screenshot } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.state = 'sent';
      this.message = '';
      this.type = 'other';
      this.screenshot = null;
      this.render();
      this.dispatchEvent(new CustomEvent('skalpai-feedback-sent'));
      setTimeout(() => {
        this.open = false;
        this.state = 'idle';
        this.render();
      }, 1500);
    } catch (err) {
      this.state = 'error';
      this.errorMsg = err instanceof Error ? err.message : 'Error';
      this.render();
    }
  }

  private render(): void {
    const L = this.labels;
    const device = window.innerWidth < 768 ? 'mobile' : 'desktop';

    this.root.innerHTML = `
      <style>${STYLES}</style>
      <button class="btn-fab" type="button" aria-label="${L.title}">
        <span aria-hidden="true">💬</span><span>${L.title}</span>
      </button>
      ${
        this.open
          ? `
        <div class="panel" role="dialog" aria-label="${L.title}">
          <div class="head">
            <span>${L.title}</span>
            <button class="close" type="button" aria-label="${L.close}">×</button>
          </div>
          ${
            this.state === 'sent'
              ? `<div class="ok">${L.thanks}</div>`
              : `
            <form class="body">
              ${this.state === 'error' ? `<div class="err">${escapeHtml(this.errorMsg)}</div>` : ''}
              <div class="types">
                ${(['bug', 'idea', 'other'] as FeedbackType[])
                  .map(
                    (t) => `
                  <button class="type" type="button" data-type="${t}" aria-pressed="${this.type === t}">${L[t]}</button>
                `,
                  )
                  .join('')}
              </div>
              <textarea placeholder="${L.placeholder}" rows="3">${escapeHtml(this.message)}</textarea>
              <div class="capture-row">
                <button class="capture-btn" type="button" ${this.capturing ? 'disabled' : ''} aria-label="${L.capture}">
                  <span aria-hidden="true">📷</span>
                  <span>${this.capturing ? L.capturing : L.capture}</span>
                </button>
                ${
                  this.screenshot
                    ? `<div class="preview">
                         <img src="${this.screenshot}" alt="screenshot preview" />
                         <button class="preview-remove" type="button" aria-label="${L.remove_screenshot}">×</button>
                       </div>`
                    : ''
                }
              </div>
              <div class="meta">${device} · ${escapeHtml(location.pathname)}</div>
              <button class="submit" type="submit" ${
                this.state === 'loading' || !this.message.trim() ? 'disabled' : ''
              }>
                ${this.state === 'loading' ? L.sending : L.send}
              </button>
            </form>
          `
          }
        </div>
      `
          : ''
      }
    `;

    this.root.querySelector('.btn-fab')?.addEventListener('click', () => {
      this.open = !this.open;
      this.render();
    });
    this.root.querySelector('.close')?.addEventListener('click', () => {
      this.open = false;
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('.type').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.type = btn.dataset.type as FeedbackType;
        this.render();
      });
    });
    const ta = this.root.querySelector('textarea');
    if (ta) {
      ta.addEventListener('input', (e) => {
        this.message = (e.target as HTMLTextAreaElement).value;
        const submit = this.root.querySelector<HTMLButtonElement>('.submit');
        if (submit) submit.disabled = !this.message.trim() || this.state === 'loading';
      });
      if (this.open && this.state === 'idle') ta.focus();
    }
    this.root.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    this.root.querySelector('.capture-btn')?.addEventListener('click', () => {
      void this.captureScreenshot();
    });
    this.root.querySelector('.preview-remove')?.addEventListener('click', () => {
      this.screenshot = null;
      this.render();
    });
  }
}

if (
  typeof window !== 'undefined' &&
  typeof customElements !== 'undefined' &&
  !customElements.get('skalpai-feedback')
) {
  customElements.define('skalpai-feedback', SkalpaiFeedbackElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'skalpai-feedback': SkalpaiFeedbackElement;
  }
}
