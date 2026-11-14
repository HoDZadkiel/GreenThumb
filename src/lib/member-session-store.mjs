// Broadcast only invalidation signals. Identity and private data always come
// from the server, never localStorage or another tab's message payload.
export const memberSessionEvent = 'greenthumb:session-change';
const storageKey = 'greenthumb.session-change';
const initialSession = Object.freeze({ user: null, auth: { google: false, email: false, password: false }, loading: true, error: '', editorVersion: 0 });

export function notifyMemberSessionChange(invalidate = true, browser = typeof window === 'undefined' ? null : window, source = '') {
  if (!browser) return;
  const detail = { source, invalidate, nonce: Math.random().toString(36).slice(2) };
  browser.dispatchEvent(new browser.CustomEvent(memberSessionEvent, { detail }));
  try { browser.localStorage.setItem(storageKey, JSON.stringify(detail)); } catch { /* Focus refresh still works when storage is unavailable. */ }
}

export function createMemberSessionStore(readSession = async signal => {
  const response = await fetch('/api/member-session', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('無法驗證登入狀態，請稍後再試。');
  return response.json();
}) {
  let snapshot = initialSession;
  let revision = 0;
  let request;
  let browser;
  let source;
  const listeners = new Set();
  function update(fields) {
    const nextUser = fields.user === undefined ? snapshot.user : fields.user;
    const changedMember = snapshot.user !== null && snapshot.user.id !== nextUser?.id;
    snapshot = { ...snapshot, ...fields, editorVersion: snapshot.editorVersion + (changedMember ? 1 : 0) };
    for (const listener of listeners) listener();
  }
  function cancel() { revision++; request?.abort(); }
  function invalidate() {
    cancel();
    // Remount member-owned editors immediately, before a replacement request.
    update({ user: null, loading: false, error: '' });
  }
  async function refresh() {
    cancel();
    const version = revision;
    const controller = new AbortController();
    request = controller;
    try {
      const result = await readSession(controller.signal);
      if (controller.signal.aborted || revision !== version) return;
      update({ user: result.user, auth: result.auth, loading: false, error: '' });
    } catch (error) {
      if (controller.signal.aborted || revision !== version) return;
      update({ loading: false, error: error.message || '無法驗證登入狀態，請稍後再試。' });
    }
  }
  function changeUser(user) {
    const changed = snapshot.user?.id !== user?.id;
    cancel();
    update({ user, loading: false, error: '' });
    notifyMemberSessionChange(changed, browser ?? null, source);
  }
  function connect(target, document) {
    browser = target;
    // Only create a random tab marker in the client effect, never during SSR.
    source ??= Math.random().toString(36).slice(2);
    const onSignal = detail => {
      if (detail?.source === source) return;
      if (detail?.invalidate) invalidate();
      void refresh();
    };
    const onLocal = event => onSignal(event.detail);
    const onStorage = event => {
      if (event.key !== storageKey) return;
      try { onSignal(JSON.parse(event.newValue ?? '{}')); } catch { /* Ignore malformed signals. */ }
    };
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    target.addEventListener(memberSessionEvent, onLocal);
    target.addEventListener('storage', onStorage);
    target.addEventListener('focus', onFocus);
    target.addEventListener('pageshow', onFocus);
    target.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    void refresh();
    return () => {
      cancel();
      target.removeEventListener(memberSessionEvent, onLocal);
      target.removeEventListener('storage', onStorage);
      target.removeEventListener('focus', onFocus);
      target.removeEventListener('pageshow', onFocus);
      target.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      browser = undefined;
    };
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSession,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    isCurrentUser: id => snapshot.user?.id === id,
    changeUser, refresh, connect,
  };
}
