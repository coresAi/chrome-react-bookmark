import { useEffect, useMemo, useRef, useState } from 'react';
import { fuzzySearchBookmarks } from '../lib/bookmarks.js';
import { UNFILED_FOLDER_ID } from '../lib/constants.js';
import { sendRuntimeMessage } from '../lib/messages.js';

const EMPTY_FOLDER_NAME = '';

function closePopupSoon() {
  window.setTimeout(() => window.close(), 120);
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function scoreHistory(query, item) {
  const title = String(item.title ?? '').toLowerCase();
  const url = String(item.url ?? '').toLowerCase();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return 0;
  }
  if (title.includes(trimmed)) {
    return 100;
  }
  if (url.includes(trimmed)) {
    return 70;
  }
  let cursor = 0;
  for (const char of trimmed) {
    const next = title.indexOf(char, cursor);
    if (next === -1) {
      return 0;
    }
    cursor = next + 1;
  }
  return 45;
}

export default function PopupApp() {
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState({ title: '', url: '', note: '', folder_id: UNFILED_FOLDER_ID });
  const [newFolderName, setNewFolderName] = useState(EMPTY_FOLDER_NAME);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('bookmarks');
  const searchRef = useRef(null);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setHistoryItems([]);
      setSelectedIndex(0);
      return;
    }

    let cancelled = false;
    chrome.history.search(
      {
        text: searchQuery,
        maxResults: 20,
        startTime: Date.now() - 1000 * 60 * 60 * 24 * 30
      },
      (items) => {
        if (!cancelled) {
          setHistoryItems(items ?? []);
          setSelectedIndex(0);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  function clearSearch() {
    setSearchQuery('');
  }

  function focusSearch() {
    setSearchQuery('');
    searchRef.current?.focus();
  }

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
      note: response.currentBookmark?.note ?? '',
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

  const bookmarkResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    return fuzzySearchBookmarks(state?.library?.bookmarks ?? [], folders, searchQuery)
      .slice(0, 8)
      .map((item) => ({
        type: 'bookmark',
        id: item.bookmark.id,
        title: item.bookmark.title,
        subtitle: item.folderLabel,
        url: item.bookmark.url
      }));
  }, [folders, searchQuery, state]);

  const historyResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    return historyItems
      .map((item) => ({
        type: 'history',
        id: item.id,
        title: item.title || shortUrl(item.url || ''),
        subtitle: formatHistoryTime(item.lastVisitTime),
        url: item.url || '',
        score: scoreHistory(searchQuery, item)
      }))
      .filter((item) => item.url && item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }, [historyItems, searchQuery]);

  const searchResults = useMemo(() => [...bookmarkResults, ...historyResults].slice(0, 10), [bookmarkResults, historyResults]);

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

  function openResult(result, newTab) {
    if (!result?.url) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'OPEN_BOOKMARK',
      payload: { url: result.url, newTab }
    });
    closePopupSoon();
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
            <h1>搜索与收藏</h1>
          </div>
          <button className="mini-link" type="button" onClick={() => sendRuntimeMessage('OPEN_EXTENSION_PAGE', { page: 'manage' })}>
            管理页
          </button>
        </div>

        <section className="popup-panel search-panel">
          <label className="search-label">
            <div className="search-input-wrap">
              <input
                ref={searchRef}
                value={searchQuery}
                placeholder="搜索书签和历史记录"
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(event) => {
                  if (!searchResults.length) {
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelectedIndex((current) => Math.min(current + 1, searchResults.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedIndex((current) => Math.max(current - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    openResult(searchResults[selectedIndex], event.metaKey || event.ctrlKey);
                  }
                }}
              />
              {searchQuery && (
                <button type="button" className="search-clear" onClick={clearSearch} title="清除搜索">
                  ×
                </button>
              )}
            </div>
          </label>
          {searchQuery.trim() ? (
            <div className="search-results">
              <div className="search-tabs">
                <button
                  type="button"
                  className={`search-tab ${activeTab === 'bookmarks' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('bookmarks')}
                >
                  书签
                </button>
                <button
                  type="button"
                  className={`search-tab ${activeTab === 'history' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  历史记录
                </button>
              </div>
              {(() => {
                const items = activeTab === 'bookmarks' ? bookmarkResults : historyResults;
                if (!items.length) {
                  return <div className="search-empty">{activeTab === 'bookmarks' ? '没有匹配到书签' : '没有匹配到历史记录'}</div>;
                }
                return items.map((item, index) => {
                  const globalIndex = searchResults.findIndex((r) => r.id === item.id && r.type === item.type);
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      className={`search-result ${selectedIndex === globalIndex ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => openResult(item, false)}
                    >
                      <span className="search-main search-main--stack">
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          ) : null}
        </section>

        {(message || error) && (
          <div className={`popup-banner ${error ? 'is-error' : 'is-success'}`}>{error || message}</div>
        )}

        {!searchFocused && (
          <>
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
                  rows={2}
                  value={draft.url}
                  onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                />
              </label>
              <label>
                <span>备注</span>
                <textarea
                  rows={2}
                  value={draft.note}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="可选备注"
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
                  placeholder="新建文件夹"
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
                      note: draft.note,
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
          </>
        )}
      </div>
    </div>
  );
}
