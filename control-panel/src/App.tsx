import { FormEvent, useEffect, useMemo, useState } from 'react';
import { adminPrompts, convex, convexUrl, type PromptVersion } from './convex';

const DEFAULT_PROMPT_KEY = 'reed_chat_system';

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function App() {
  const [adminSecret, setAdminSecret] = useState('');
  const [promptKeys, setPromptKeys] = useState<string[]>([DEFAULT_PROMPT_KEY]);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_PROMPT_KEY);
  const [activePrompt, setActivePrompt] = useState<PromptVersion | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Enter the admin secret to load prompts.');
  const [isBusy, setIsBusy] = useState(false);

  const canLoad = Boolean(convex && adminSecret.trim());
  const hasChanges = useMemo(() => draft.trim() !== (activePrompt?.content ?? '').trim(), [activePrompt, draft]);

  async function loadPrompt(key = selectedKey) {
    if (!convex || !adminSecret.trim()) return;

    setIsBusy(true);
    setStatus('Loading prompt...');
    try {
      const [keys, active, history] = await Promise.all([
        convex.query(adminPrompts.listPromptKeys, { adminSecret }),
        convex.query(adminPrompts.getActivePrompt, { adminSecret, key }),
        convex.query(adminPrompts.listPromptVersions, { adminSecret, key }),
      ]);
      setPromptKeys(keys.length > 0 ? keys : [DEFAULT_PROMPT_KEY]);
      setActivePrompt(active);
      setVersions(history);
      setDraft(active?.content ?? '');
      setStatus(active ? `Loaded ${key} v${active.version}.` : `No active prompt exists for ${key}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load prompts.');
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (canLoad) void loadPrompt(selectedKey);
  }, [selectedKey]);

  async function handleSecretSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPrompt(selectedKey);
  }

  async function savePrompt() {
    if (!convex || !adminSecret.trim()) return;

    setIsBusy(true);
    setStatus('Saving prompt...');
    try {
      await convex.mutation(adminPrompts.saveActivePrompt, {
        adminSecret,
        content: draft,
        key: selectedKey,
      });
      await loadPrompt(selectedKey);
      setStatus('Saved as the active prompt.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save prompt.');
    } finally {
      setIsBusy(false);
    }
  }

  async function rollbackPrompt(version: number) {
    if (!convex || !adminSecret.trim()) return;
    if (!window.confirm(`Make version ${version} the active ${selectedKey} prompt?`)) return;

    setIsBusy(true);
    setStatus(`Rolling back to v${version}...`);
    try {
      await convex.mutation(adminPrompts.rollbackPrompt, {
        adminSecret,
        key: selectedKey,
        version,
      });
      await loadPrompt(selectedKey);
      setStatus(`Rolled back to v${version}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not roll back prompt.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="brand">Reed Control</p>
          <h1>Prompts</h1>
        </div>

        <form className="stack" onSubmit={handleSecretSubmit}>
          <label>
            <span>Admin secret</span>
            <input
              autoComplete="off"
              onChange={event => setAdminSecret(event.target.value)}
              placeholder="Paste once per session"
              type="password"
              value={adminSecret}
            />
          </label>
          <button disabled={!convex || !adminSecret.trim() || isBusy} type="submit">
            Load
          </button>
        </form>

        <label>
          <span>Prompt key</span>
          <select disabled={!canLoad || isBusy} onChange={event => setSelectedKey(event.target.value)} value={selectedKey}>
            {promptKeys.map(key => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <p className={convexUrl ? 'status' : 'status error'}>
          {convexUrl ? status : 'Missing VITE_CONVEX_URL. Run through make control-panel so Reed env is loaded.'}
        </p>
      </aside>

      <section className="editor">
        <header className="editorHeader">
          <div>
            <p className="meta">{activePrompt ? `Active v${activePrompt.version} · ${activePrompt.contentHash}` : 'No active prompt'}</p>
            <h2>{selectedKey}</h2>
          </div>
          <button disabled={!canLoad || !hasChanges || isBusy || draft.trim().length < 100} onClick={savePrompt} type="button">
            Save version
          </button>
        </header>

        <textarea
          disabled={!canLoad || isBusy}
          onChange={event => setDraft(event.target.value)}
          placeholder="Load a prompt to edit it."
          spellCheck={false}
          value={draft}
        />

        <section className="history">
          <h3>Version history</h3>
          {versions.length === 0 ? (
            <p className="empty">No saved versions yet.</p>
          ) : (
            <div className="versionList">
              {versions.map(version => (
                <article className="versionRow" key={version._id}>
                  <div>
                    <strong>v{version.version}</strong>
                    <span>{version.status}</span>
                    <p>{formatDate(version.updatedAt)}</p>
                  </div>
                  <button
                    disabled={version.status === 'active' || isBusy}
                    onClick={() => void rollbackPrompt(version.version)}
                    type="button"
                  >
                    Rollback
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
