import { useEffect, useMemo, useState } from 'react';
import { UNFILED_FOLDER_ID } from '../lib/constants.js';
import { sendRuntimeMessage } from '../lib/messages.js';

const EMPTY_FOLDER_NAME = '';

function closePopupSoon() {
  window.setTimeout(() => window.close(), 120);
}

export default function PopupApp() {
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState({ title: '', url: '', folder_id: UNFILED_FOLDER_ID });
  const [newFolderName, setNewFolderName] = useState(EMPTY_FOLDER_NAME);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const response = await sendRuntimeMessage('GET_POPUP_STATE');
    if (response.ok === false) {
      setError(response.error);
      setState({
        isAuthed: false,
        library: { folders: [], bookmarks: [] },
        session: null,
        activeTab: null,
        currentBookmark: null
      });
      return;
    }
    setState(response);
    setDraft({
      title: response.currentBookmark?.title ?? response.activeTab?.title ?? '',
      url: response.currentBookmark?.url ?? response.activeTab?.url ?? '',
      folder_id: response.currentBookmark?.folder_id ?? UNFILED_FOLDER_ID
    });
  }

  async function run(action, successText) {
    setIsBusy(true);
    setError('');
    setMessage('');
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

  const folders = useMemo(() => state?.library?.folders ?? [], [state]);
  const isAuthed = Boolean(state?.isAuthed);
  const isExisting = Boolean(state?.currentBookmark?.id);
  const canSave = draft.title.trim() && draft.url.trim();

  async function handleCreateFolder() {
    setIsBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await sendRuntimeMessage('CREATE_FOLDER', { name: newFolderName });
      if (response.ok === false) {
        throw new Error(response.error);
      }
      await refresh();
      setDraft((current) => ({ ...current, folder_id: response.folder.id }));
      setNewFolderName(EMPTY_FOLDER_NAME);
      setMessage('文件夹已创建');
    } catch (nextError) {
      setError(nextError.message || '操作失败');
    } finally {
      setIsBusy(false);
    }
  }

  if (!state) {
    return <div className="popup-shell loading">正在准备收藏器...</div>;
  }

  return (
    <div className="popup-shell">
      <div className="popup-card">
        <div className="popup-top">
          <div>
            <p className="popup-eyebrow">Bookmark Flow</p>
            <h1>{isExisting ? '编辑当前收藏' : '收藏当前页面'}</h1>
          </div>
        </div>

        {(message || error) && (
          <div className={`popup-banner ${error ? 'is-error' : 'is-success'}`}>{error || message}</div>
        )}

        {!isAuthed ? (
          <section className="popup-panel">
            <div className="status-pill">需要登录</div>
            <h2>先登录，再收藏当前页面。</h2>
            <div className="popup-actions">
              <button className="primary-popup" type="button" onClick={() => sendRuntimeMessage('OPEN_EXTENSION_PAGE', { page: 'settings' })}>
                去登录 / 注册
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="popup-panel">
              <div className="row-head">
                <span className={`status-pill ${isExisting ? 'is-saved' : ''}`}>{isExisting ? '已收藏' : '未收藏'}</span>
                <span className="popup-account">{state.session?.user?.email}</span>
              </div>
              <label>
                <span>标题</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label>
                <span>URL</span>
                <textarea
                  rows={3}
                  value={draft.url}
                  onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                />
              </label>
              <label>
                <span>文件夹</span>
                <select
                  value={draft.folder_id ?? UNFILED_FOLDER_ID}
                  onChange={(event) => setDraft((current) => ({ ...current, folder_id: event.target.value }))}
                >
                  <option value={UNFILED_FOLDER_ID}>未分类</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="new-folder-row">
                <input
                  value={newFolderName}
                  placeholder="在这里新建文件夹"
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
                <button
                  className="ghost-popup"
                  type="button"
                  disabled={isBusy || !newFolderName.trim()}
                  onClick={handleCreateFolder}
                >
                  新建
                </button>
              </div>
            </section>

            <div className="popup-actions wide">
              <button
                className="primary-popup"
                type="button"
                disabled={isBusy || !canSave}
                onClick={() =>
                  run(async () => {
                    const response = await sendRuntimeMessage('UPSERT_BOOKMARK', {
                      ...state.currentBookmark,
                      title: draft.title,
                      url: draft.url,
                      folder_id: draft.folder_id === UNFILED_FOLDER_ID ? null : draft.folder_id,
                      id: state.currentBookmark?.id
                    });
                    if (response.ok === false) {
                      throw new Error(response.error);
                    }
                    closePopupSoon();
                  }, isExisting ? '收藏已更新' : '当前页面已收藏')
                }
              >
                {isExisting ? '保存修改' : '加入书签'}
              </button>
              {isExisting ? (
                <button
                  className="danger-popup"
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(async () => {
                      const response = await sendRuntimeMessage('DELETE_BOOKMARK', {
                        bookmarkId: state.currentBookmark.id
                      });
                      if (response.ok === false) {
                        throw new Error(response.error);
                      }
                      closePopupSoon();
                    }, '当前收藏已删除')
                  }
                >
                  删除收藏
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
