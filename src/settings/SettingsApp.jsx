import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/constants.js';
import { sendRuntimeMessage } from '../lib/messages.js';

export default function SettingsApp() {
  const [state, setState] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const response = await sendRuntimeMessage('GET_STATE');
    if (response.ok === false) {
      setError(response.error);
      setState({
        isAuthed: false,
        library: { folders: [], bookmarks: [] },
        session: null,
        settings: settingsDraft
      });
      return;
    }
    setState(response);
    setSettingsDraft(response.settings);
  }

  async function run(action, successText) {
    setIsBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
      if (successText) {
        setMessage(successText);
      }
      await refresh();
    } catch (nextError) {
      setError(nextError.message || '操作失败');
    } finally {
      setIsBusy(false);
    }
  }

  if (!state) {
    return <div className="loading-state">正在加载设置页...</div>;
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Bookmark Flow</p>
          <h1>把连接配置、登录注册和账号状态留在一个单独、安静的设置空间里。</h1>
        </div>
        <div className="hero-meta">
          <span>{state.session?.user?.email || '未登录'}</span>
          <button className="ghost-button" type="button" onClick={() => sendRuntimeMessage('OPEN_EXTENSION_PAGE', { page: 'manage' })}>
            打开管理页
          </button>
        </div>
      </header>

      {(message || error) && <div className={`banner ${error ? 'is-error' : 'is-success'}`}>{error || message}</div>}

      <div className="settings-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              const response = await sendRuntimeMessage('SAVE_SETTINGS', settingsDraft);
              if (response.ok === false) {
                throw new Error(response.error);
              }
            }, 'Supabase 配置已保存');
          }}
        >
          <div className="panel-head">
            <h2>Supabase 连接</h2>
            <p>首次进入已经带默认 URL 与匿名密钥，你可以直接使用，也可以切换为自己的项目。</p>
          </div>
          <div className="stack">
            <label>
              <span>Project URL</span>
              <input
                value={settingsDraft.supabaseUrl}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, supabaseUrl: event.target.value }))}
              />
            </label>
            <label>
              <span>Anon Key</span>
              <textarea
                rows={5}
                value={settingsDraft.supabaseAnonKey}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, supabaseAnonKey: event.target.value }))}
              />
            </label>
            <button className="primary-button" type="submit" disabled={isBusy}>
              保存连接配置
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head">
            <h2>{state.isAuthed ? '账户状态' : '登录 / 注册'}</h2>
            <p>使用邮箱密码登录 Supabase。所有收藏和编辑都会直接写入你的 Supabase 账号空间。</p>
          </div>
          {state.isAuthed ? (
            <div className="account-card">
              <div>
                <strong>{state.session.user.email}</strong>
                <p className="muted">当前扩展的收藏、编辑、移动和删除都会直接保存到 Supabase。</p>
              </div>
              <button
                className="danger-button"
                type="button"
                disabled={isBusy}
                onClick={() =>
                  run(async () => {
                    const response = await sendRuntimeMessage('AUTH_SIGN_OUT');
                    if (response.ok === false) {
                      throw new Error(response.error);
                    }
                  }, '已退出登录')
                }
              >
                退出登录
              </button>
            </div>
          ) : (
            <div className="stack">
              <label>
                <span>邮箱</span>
                <input
                  value={authForm.email}
                  placeholder="you@example.com"
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                <span>密码</span>
                <input
                  type="password"
                  value={authForm.password}
                  placeholder="至少 6 位"
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(async () => {
                      const response = await sendRuntimeMessage('AUTH_SIGN_IN', authForm);
                      if (response.ok === false) {
                        throw new Error(response.error);
                      }
                      setAuthForm({ email: '', password: '' });
                    }, '登录成功')
                  }
                >
                  登录
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(async () => {
                      const response = await sendRuntimeMessage('AUTH_SIGN_UP', authForm);
                      if (response.ok === false) {
                        throw new Error(response.error);
                      }
                      setAuthForm({ email: '', password: '' });
                    }, '注册请求已发送')
                  }
                >
                  注册
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
