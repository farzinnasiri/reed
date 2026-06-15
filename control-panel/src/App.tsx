import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminPrompts, convex, convexUrl, type PromptVersion, type ReedDebugContext, type ReedProfileOption } from './convex';

const DEFAULT_PROMPT_KEY = 'reed_chat_system';

function formatDate(timestamp: number | null | undefined) {
  if (!timestamp) return 'n/a';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('FunctionPathNotFound')) {
    return 'Convex does not have the Reed debug functions on this deployment yet. Run Convex codegen/dev for the same ENV as the control panel, then reload.';
  }
  return message;
}

export function App() {
  const [adminSecret, setAdminSecret] = useState('');
  const [activeView, setActiveView] = useState<'prompts' | 'reed'>('prompts');
  const [promptKeys, setPromptKeys] = useState<string[]>([DEFAULT_PROMPT_KEY]);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_PROMPT_KEY);
  const [activePrompt, setActivePrompt] = useState<PromptVersion | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [draft, setDraft] = useState('');
  const [profiles, setProfiles] = useState<ReedProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [debugContext, setDebugContext] = useState<ReedDebugContext | null>(null);
  const [status, setStatus] = useState('Enter the admin secret to load the control panel.');
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
      setStatus(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function loadProfiles(nextProfileId = selectedProfileId) {
    if (!convex || !adminSecret.trim()) return;

    setIsBusy(true);
    setStatus('Loading Reed profiles...');
    try {
      const loadedProfiles = await convex.query(adminPrompts.listReedProfiles, { adminSecret });
      const profileId = nextProfileId || loadedProfiles[0]?._id || '';
      setProfiles(loadedProfiles);
      setSelectedProfileId(profileId);
      if (profileId) {
        const context = await convex.query(adminPrompts.getReedDebugContext, { adminSecret, profileId });
        setDebugContext(context);
        setStatus(`Loaded Reed context for ${context.profile.email}.`);
      } else {
        setDebugContext(null);
        setStatus('No profiles found.');
      }
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (canLoad && activeView === 'prompts') void loadPrompt(selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    if (canLoad && activeView === 'reed' && profiles.length === 0) void loadProfiles();
  }, [activeView]);

  async function handleSecretSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeView === 'reed') {
      await loadProfiles(selectedProfileId);
    } else {
      await loadPrompt(selectedKey);
    }
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
      setStatus(errorMessage(error));
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
      setStatus(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="brand">Reed Control</p>
          <h1>{activeView === 'reed' ? 'Context' : 'Prompts'}</h1>
        </div>

        <div className="tabs" role="tablist" aria-label="Control panel views">
          <button className={activeView === 'prompts' ? 'tab active' : 'tab'} onClick={() => setActiveView('prompts')} type="button">
            Prompts
          </button>
          <button className={activeView === 'reed' ? 'tab active' : 'tab'} onClick={() => setActiveView('reed')} type="button">
            Reed context
          </button>
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

        {activeView === 'prompts' ? (
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
        ) : (
          <label>
            <span>User</span>
            <select
              disabled={!canLoad || isBusy || profiles.length === 0}
              onChange={event => {
                setSelectedProfileId(event.target.value);
                void loadProfiles(event.target.value);
              }}
              value={selectedProfileId}
            >
              {profiles.map(profile => (
                <option key={profile._id} value={profile._id}>
                  {profile.email}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className={convexUrl ? 'status' : 'status error'}>
          {convexUrl ? status : 'Missing VITE_CONVEX_URL. Run through make control-panel so Reed env is loaded.'}
        </p>
      </aside>

      {activeView === 'reed' ? (
        <ReedContextView
          canLoad={canLoad}
          context={debugContext}
          isBusy={isBusy}
          onReload={() => void loadProfiles(selectedProfileId)}
        />
      ) : (
        <PromptEditor
          activePrompt={activePrompt}
          canLoad={canLoad}
          draft={draft}
          hasChanges={hasChanges}
          isBusy={isBusy}
          onDraftChange={setDraft}
          onRollback={rollbackPrompt}
          onSave={savePrompt}
          selectedKey={selectedKey}
          versions={versions}
        />
      )}
    </main>
  );
}

function PromptEditor(props: {
  activePrompt: PromptVersion | null;
  canLoad: boolean;
  draft: string;
  hasChanges: boolean;
  isBusy: boolean;
  onDraftChange: (value: string) => void;
  onRollback: (version: number) => void;
  onSave: () => void;
  selectedKey: string;
  versions: PromptVersion[];
}) {
  return (
    <section className="editor">
      <header className="editorHeader">
        <div>
          <p className="meta">{props.activePrompt ? `Active v${props.activePrompt.version} · ${props.activePrompt.contentHash}` : 'No active prompt'}</p>
          <h2>{props.selectedKey}</h2>
        </div>
        <button disabled={!props.canLoad || !props.hasChanges || props.isBusy || props.draft.trim().length < 100} onClick={props.onSave} type="button">
          Save version
        </button>
      </header>

      <textarea
        disabled={!props.canLoad || props.isBusy}
        onChange={event => props.onDraftChange(event.target.value)}
        placeholder="Load a prompt to edit it."
        spellCheck={false}
        value={props.draft}
      />

      <section className="history">
        <h3>Version history</h3>
        {props.versions.length === 0 ? (
          <p className="empty">No saved versions yet.</p>
        ) : (
          <div className="versionList">
            {props.versions.map(version => (
              <article className="versionRow" key={version._id}>
                <div>
                  <strong>v{version.version}</strong>
                  <span>{version.status}</span>
                  <p>{formatDate(version.updatedAt)}</p>
                </div>
                <button
                  disabled={version.status === 'active' || props.isBusy}
                  onClick={() => props.onRollback(version.version)}
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
  );
}

function ReedContextView(props: { canLoad: boolean; context: ReedDebugContext | null; isBusy: boolean; onReload: () => void }) {
  const context = props.context;
  const [section, setSection] = useState<'injected' | 'memory' | 'conversation' | 'raw'>('injected');
  return (
    <section className="debug">
      <header className="editorHeader">
        <div>
          <p className="meta">{context ? `Loaded ${formatDate(context.loadedAt)}` : 'No user loaded'}</p>
          <h2>{context ? context.profile.email : 'Reed context'}</h2>
        </div>
        <button disabled={!props.canLoad || props.isBusy} onClick={props.onReload} type="button">
          Reload
        </button>
      </header>

      {!context ? (
        <p className="empty">Load a user to inspect Reed context.</p>
      ) : (
        <div className="debugLayout">
          <aside className="contextRail">
            <div className="profileBlock">
              <strong>{context.profile.displayName || context.profile.email}</strong>
              <span>{context.profile.email}</span>
            </div>
            <Metric label="Agenda" value={String(context.activeThread?.agendaItems.length ?? 0)} />
            <Metric label="Journeys" value={String(context.journeys.length)} />
            <Metric label="Summaries" value={String(context.summaries.length)} />
            <Metric label="Messages" value={String(context.recentMessages.length)} />
            <nav className="sectionNav" aria-label="Reed context sections">
              <button className={section === 'injected' ? 'active' : ''} onClick={() => setSection('injected')} type="button">Injected now</button>
              <button className={section === 'memory' ? 'active' : ''} onClick={() => setSection('memory')} type="button">Memory</button>
              <button className={section === 'conversation' ? 'active' : ''} onClick={() => setSection('conversation')} type="button">Conversation</button>
              <button className={section === 'raw' ? 'active' : ''} onClick={() => setSection('raw')} type="button">Raw</button>
            </nav>
          </aside>

          <div className="contextPane">
            {section === 'injected' ? <InjectedNow context={context} /> : null}
            {section === 'memory' ? <MemoryView context={context} /> : null}
            {section === 'conversation' ? <ConversationView context={context} /> : null}
            {section === 'raw' ? (
              <Panel title="Raw database snapshot" meta="For field-level debugging">
                <Pre value={formatJson(context)} />
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function InjectedNow(props: { context: ReedDebugContext }) {
  const context = props.context;
  return (
    <div className="contextStack">
      <Panel title="Session agenda" meta="Reed's checklist for the next turn">
        {context.activeThread?.agendaItems.length ? (
          <ol className="agendaList">
            {context.activeThread.agendaItems.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        ) : (
          <p className="empty">No active agenda.</p>
        )}
      </Panel>

      <Panel title="Coach mental model" meta={context.mentalModel ? `updated ${formatDate(context.mentalModel.updatedAt)}` : undefined}>
        <ReadableText value={context.mentalModel?.content} />
      </Panel>

      <Panel title="Coach state" meta={context.coachState ? `updated ${formatDate(context.coachState.updatedAt)}` : undefined}>
        <ReadableText value={context.coachState?.content} />
      </Panel>

      <Panel title="Strong journeys" meta="Likely to shape the reply">
        <JourneyList journeys={context.journeys.filter(journey => journey.status !== 'archived' && journey.strength >= 0.45)} />
      </Panel>
    </div>
  );
}

function MemoryView(props: { context: ReedDebugContext }) {
  const context = props.context;
  return (
    <div className="contextStack">
      <Panel title="All private journeys" meta={`${context.journeys.length} latest`}>
        <JourneyList journeys={context.journeys} />
      </Panel>

      <Panel title="Compacted summaries" meta="Old chat continuity">
        {context.summaries.length === 0 ? (
          <p className="empty">No summaries.</p>
        ) : (
          <div className="summaryList">
            {context.summaries.map(summary => (
              <article className="summaryRow" key={summary._id}>
                <p className="meta">{summary.modelName} · {formatDate(summary.createdAt)}</p>
                <ReadableText value={summary.content} />
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Deterministic journey snapshot" meta={context.journeySnapshot ? `${context.journeySnapshot.trigger} · ${formatDate(context.journeySnapshot.createdAt)}` : undefined}>
        <ReadableText value={context.journeySnapshot?.renderedContext} />
      </Panel>
    </div>
  );
}

function ConversationView(props: { context: ReedDebugContext }) {
  return (
    <Panel title="Recent messages" meta={`${props.context.recentMessages.length} latest`}>
      <div className="messageList">
        {props.context.recentMessages.map(message => (
          <article className={`messageRow ${message.role}`} key={message._id}>
            <p className="meta">{message.role} · {message.status} · {formatDate(message.completedAt ?? message.createdAt)}</p>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function JourneyList(props: { journeys: ReedDebugContext['journeys'] }) {
  if (props.journeys.length === 0) return <p className="empty">No journeys.</p>;
  return (
    <div className="journeyList">
      {props.journeys.map(journey => (
        <article className="journeyRow" key={journey._id}>
          <div>
            <strong>{journey.title}</strong>
            <span>{journey.status}</span>
          </div>
          <p>{journey.summary}</p>
          <footer>
            <small>strength {journey.strength.toFixed(2)}</small>
            <small>confidence {journey.confidence.toFixed(2)}</small>
            <small>{formatDate(journey.lastEvidenceAt)}</small>
          </footer>
        </article>
      ))}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Panel(props: { children: ReactNode; meta?: string; title: string }) {
  return (
    <section className="panel">
      <header>
        <h3>{props.title}</h3>
        {props.meta ? <p className="meta">{props.meta}</p> : null}
      </header>
      {props.children}
    </section>
  );
}

function Pre(props: { value: string | null | undefined }) {
  return props.value ? <pre>{props.value}</pre> : <p className="empty">No data.</p>;
}

function ReadableText(props: { value: string | null | undefined }) {
  return props.value ? <p className="readableText">{props.value}</p> : <p className="empty">No data.</p>;
}
