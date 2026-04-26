import { useEffect, useMemo, useState } from 'react';
import { bookmarksForFolder, fuzzySearchBookmarks, sortFolders, sortBookmarks } from '../lib/bookmarks.js';
import { ALL_BOOKMARKS_FOLDER_ID, UNFILED_FOLDER_ID } from '../lib/constants.js';
import { sendRuntimeMessage } from '../lib/messages.js';

function normalizeFolderId(folderId) {
  return folderId ?? UNFILED_FOLDER_ID;
}

function titleMatches(query, title) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTitle = String(title ?? '').toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    return true;
  }
  let cursor = 0;
  for (const char of normalizedQuery) {
    const next = normalizedTitle.indexOf(char, cursor);
    if (next === -1) {
      return false;
    }
    cursor = next + 1;
  }
  return true;
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

export default function ManageApp() {
  const [state, setState] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(UNFILED_FOLDER_ID);
  const [folderName, setFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUrlId, setEditingUrlId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [draftTitles, setDraftTitles] = useState({});
  const [draftUrls, setDraftUrls] = useState({});
  const [draftNotes, setDraftNotes] = useState({});
  const [dragBookmarkId, setDragBookmarkId] = useState(null);
  const [dragFolderId, setDragFolderId] = useState(null);
  const [dropFolderId, setDropFolderId] = useState(null);
  const [dropBookmarkId, setDropBookmarkId] = useState(null);
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
        session: null
      });
      return;
    }
    setState(response);
    setDraftTitles((current) => {
      const next = {};
      for (const bookmark of response.library?.bookmarks ?? []) {
        next[bookmark.id] = current[bookmark.id] ?? bookmark.title;
      }
      return next;
    });
    setDraftUrls((current) => {
      const next = {};
      for (const bookmark of response.library?.bookmarks ?? []) {
        next[bookmark.id] = current[bookmark.id] ?? bookmark.url;
      }
      return next;
    });
    setDraftNotes((current) => {
      const next = {};
      for (const bookmark of response.library?.bookmarks ?? []) {
        next[bookmark.id] = current[bookmark.id] ?? (bookmark.note ?? '');
      }
      return next;
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
      setDropFolderId(null);
      setDropBookmarkId(null);
      setDragBookmarkId(null);
      setDragFolderId(null);
    }
  }

  const folders = useMemo(() => sortFolders(state?.library?.folders ?? []), [state]);
  const visibleBookmarks = useMemo(() => {
    const source =
      selectedFolderId === ALL_BOOKMARKS_FOLDER_ID
        ? sortBookmarks(state?.library?.bookmarks ?? [])
        : bookmarksForFolder(state?.library?.bookmarks ?? [], selectedFolderId);
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return source;
    }
    if (selectedFolderId === ALL_BOOKMARKS_FOLDER_ID) {
      return fuzzySearchBookmarks(source, folders, trimmed).map((item) => item.bookmark);
    }
    return source.filter((bookmark) => titleMatches(trimmed, bookmark.title));
  }, [folders, searchQuery, selectedFolderId, state]);

  async function saveTitle(bookmark) {
    const nextTitle = (draftTitles[bookmark.id] ?? '').trim();
    if (!nextTitle || nextTitle === bookmark.title) {
      return;
    }

    await run(async () => {
      const response = await sendRuntimeMessage('UPSERT_BOOKMARK', {
        ...bookmark,
        title: nextTitle
      });
      if (response.ok === false) {
        throw new Error(response.error);
      }
    }, '标题已更新');
  }

  async function saveUrl(bookmark) {
    const nextUrl = (draftUrls[bookmark.id] ?? '').trim();
    if (!nextUrl || nextUrl === bookmark.url) {
      setEditingUrlId(null);
      return;
    }

    await run(async () => {
      const response = await sendRuntimeMessage('UPSERT_BOOKMARK', {
        ...bookmark,
        url: nextUrl
      });
      if (response.ok === false) {
        throw new Error(response.error);
      }
      setEditingUrlId(null);
    }, '链接已更新');
  }

  async function saveNote(bookmark) {
    const nextNote = draftNotes[bookmark.id] ?? '';
    if (nextNote === (bookmark.note ?? '')) {
      setEditingNoteId(null);
      return;
    }

    await run(async () => {
      const response = await sendRuntimeMessage('UPSERT_BOOKMARK', {
        ...bookmark,
        note: nextNote
      });
      if (response.ok === false) {
        throw new Error(response.error);
      }
      setEditingNoteId(null);
    }, '备注已更新');
  }

  if (!state) {
    return <div className="loading-state">正在加载书签管理页...</div>;
  }

  if (!state.isAuthed) {
    return (
      <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Bookmark Flow</p>
          <h1>先登录，再进入你的云端书签库。</h1>
        </div>
      </header>
      {error ? <div className="banner is-error">{error}</div> : null}
        <section className="panel empty-hero">
          <div className="panel-head">
            <h2>还没有登录</h2>
            <p>这版管理页只展示 Supabase 里的真实数据，所以先去设置页登录或注册。</p>
          </div>
          <button className="primary-button" type="button" onClick={() => sendRuntimeMessage('OPEN_EXTENSION_PAGE', { page: 'settings' })}>
            打开设置页
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Bookmark Flow</p>
          <h1>书签管理</h1>
        </div>
        <div className="hero-meta">
          <span>{state.session?.user?.email}</span>
          <button className="ghost-button" type="button" onClick={() => sendRuntimeMessage('OPEN_EXTENSION_PAGE', { page: 'settings' })}>
            设置 / 账户
          </button>
        </div>
      </header>

      {(message || error) && <div className={`banner ${error ? 'is-error' : 'is-success'}`}>{error || message}</div>}

      <div className="manage-layout">
        <aside className="panel sidebar">
          <div className="panel-head">
            <h2>文件夹</h2>
            <p>点击切换列表，拖拽句柄调整顺序，直接把书签拖到文件夹里完成归类。</p>
          </div>

          <form
            className="create-folder"
            onSubmit={(event) => {
              event.preventDefault();
              if (!folderName.trim()) {
                return;
              }
              run(async () => {
                const response = await sendRuntimeMessage('CREATE_FOLDER', { name: folderName });
                if (response.ok === false) {
                  throw new Error(response.error);
                }
                setFolderName('');
              }, '文件夹已创建');
            }}
          >
            <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="新建文件夹" />
            <button className="primary-button" type="submit" disabled={isBusy}>
              添加
            </button>
          </form>

          <div className="folder-list">
            {[{ id: ALL_BOOKMARKS_FOLDER_ID, name: '全部书签' }, { id: UNFILED_FOLDER_ID, name: '未分类' }, ...folders].map((folder) => {
              const isBuiltIn = folder.id === UNFILED_FOLDER_ID || folder.id === ALL_BOOKMARKS_FOLDER_ID;
              const isActive = selectedFolderId === folder.id;
              const isDropTarget = dropFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  className={`folder-row ${isActive ? 'is-active' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragBookmarkId && folder.id !== ALL_BOOKMARKS_FOLDER_ID) {
                      setDropFolderId(folder.id);
                    }
                    if (dragFolderId && dragFolderId !== folder.id) {
                      setDropFolderId(folder.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropFolderId === folder.id) {
                      setDropFolderId(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragBookmarkId && folder.id !== ALL_BOOKMARKS_FOLDER_ID) {
                      run(async () => {
                        const response = await sendRuntimeMessage('MOVE_BOOKMARK', {
                          bookmarkId: dragBookmarkId,
                          folderId: folder.id,
                          targetId: null
                        });
                        if (response.ok === false) {
                          throw new Error(response.error);
                        }
                      }, '书签已移动');
                      return;
                    }

                    if (!isBuiltIn && dragFolderId && dragFolderId !== folder.id) {
                      run(async () => {
                        const response = await sendRuntimeMessage('REORDER_FOLDERS', {
                          draggedId: dragFolderId,
                          targetId: folder.id
                        });
                        if (response.ok === false) {
                          throw new Error(response.error);
                        }
                      }, '文件夹顺序已更新');
                    }
                  }}
                >
                  {!isBuiltIn ? (
                    <button
                      className="drag-handle"
                      type="button"
                      draggable
                      aria-label="拖动文件夹排序"
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDragFolderId(folder.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      ::
                    </button>
                  ) : (
                    <span className="folder-spacer" />
                  )}

                  <button className="folder-switch" type="button" onClick={() => setSelectedFolderId(folder.id)}>
                    <span>{folder.name}</span>
                  </button>

                  {!isBuiltIn ? (
                    <div className="folder-actions">
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => {
                          const nextName = window.prompt('重命名文件夹', folder.name);
                          if (!nextName || nextName === folder.name) {
                            return;
                          }
                          run(async () => {
                            const response = await sendRuntimeMessage('UPDATE_FOLDER', {
                              id: folder.id,
                              name: nextName
                            });
                            if (response.ok === false) {
                              throw new Error(response.error);
                            }
                          }, '文件夹名称已更新');
                        }}
                      >
                        改名
                      </button>
                      <button
                        className="link-button danger-text"
                        type="button"
                        onClick={() =>
                          run(async () => {
                            const response = await sendRuntimeMessage('DELETE_FOLDER', { folderId: folder.id });
                            if (response.ok === false) {
                              throw new Error(response.error);
                            }
                            if (selectedFolderId === folder.id) {
                              setSelectedFolderId(UNFILED_FOLDER_ID);
                            }
                          }, '文件夹已删除')
                        }
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="panel library-panel">
          <div className="panel-head">
            <h2>
              {selectedFolderId === ALL_BOOKMARKS_FOLDER_ID
                ? '全部书签'
                : selectedFolderId === UNFILED_FOLDER_ID
                  ? '未分类书签'
                  : folders.find((item) => item.id === selectedFolderId)?.name || '书签'}
            </h2>
            <p>{selectedFolderId === ALL_BOOKMARKS_FOLDER_ID ? '搜索整个书签库。' : '按标题模糊搜索，网址默认摘要显示，需要时再展开编辑。'}</p>
          </div>
          <div className="library-toolbar">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={selectedFolderId === ALL_BOOKMARKS_FOLDER_ID ? '搜索全部书签' : '搜索标题'}
            />
          </div>

          <div className="bookmark-list">
            {visibleBookmarks.length === 0 ? (
              <div className="empty-block">这个分组里还没有书签。</div>
            ) : (
              visibleBookmarks.map((bookmark) => {
                const isDropTarget = dropBookmarkId === bookmark.id;
                const isEditingUrl = editingUrlId === bookmark.id;

                return (
                  <article
                    key={bookmark.id}
                    className={`bookmark-card ${isDropTarget ? 'is-drop-target' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (dragBookmarkId && dragBookmarkId !== bookmark.id) {
                        setDropBookmarkId(bookmark.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dropBookmarkId === bookmark.id) {
                        setDropBookmarkId(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!dragBookmarkId || dragBookmarkId === bookmark.id) {
                        return;
                      }
                      run(async () => {
                        const response = await sendRuntimeMessage('MOVE_BOOKMARK', {
                          bookmarkId: dragBookmarkId,
                          folderId: selectedFolderId,
                          targetId: bookmark.id
                        });
                        if (response.ok === false) {
                          throw new Error(response.error);
                        }
                      }, '书签顺序已更新');
                    }}
                  >
                    <button
                      className="drag-handle bookmark-handle"
                      type="button"
                      draggable
                      aria-label="拖动书签排序"
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDragBookmarkId(bookmark.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      ::
                    </button>

                    <div className="bookmark-main">
                      <input
                        className="title-input"
                        value={draftTitles[bookmark.id] ?? bookmark.title}
                        onChange={(event) =>
                          setDraftTitles((current) => ({
                            ...current,
                            [bookmark.id]: event.target.value
                          }))
                        }
                        onBlur={() => saveTitle(bookmark)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                      />

                      {isEditingUrl ? (
                        <input
                          className="url-input"
                          value={draftUrls[bookmark.id] ?? bookmark.url}
                          onChange={(event) =>
                            setDraftUrls((current) => ({
                              ...current,
                              [bookmark.id]: event.target.value
                            }))
                          }
                          onBlur={() => saveUrl(bookmark)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }
                            if (event.key === 'Escape') {
                              setDraftUrls((current) => ({
                                ...current,
                                [bookmark.id]: bookmark.url
                              }));
                              setEditingUrlId(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="bookmark-meta">
                          <a className="url-preview" href={bookmark.url} target="_blank" rel="noreferrer" title={bookmark.url}>
                            {shortUrl(bookmark.url)}
                          </a>
                          {editingNoteId === bookmark.id ? (
                            <input
                              className="note-input"
                              value={draftNotes[bookmark.id] ?? ''}
                              onChange={(event) =>
                                setDraftNotes((current) => ({
                                  ...current,
                                  [bookmark.id]: event.target.value
                                }))
                              }
                              onBlur={() => saveNote(bookmark)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur();
                                }
                                if (event.key === 'Escape') {
                                  setDraftNotes((current) => ({
                                    ...current,
                                    [bookmark.id]: bookmark.note ?? ''
                                  }));
                                  setEditingNoteId(null);
                                }
                              }}
                              placeholder="添加备注"
                              autoFocus
                            />
                          ) : bookmark.note ? (
                            <p className="note-preview" title={bookmark.note}>{bookmark.note}</p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="bookmark-tools">
                      <select
                        value={normalizeFolderId(bookmark.folder_id)}
                        onChange={(event) =>
                          run(async () => {
                            const response = await sendRuntimeMessage('UPSERT_BOOKMARK', {
                              ...bookmark,
                              folder_id: event.target.value
                            });
                            if (response.ok === false) {
                              throw new Error(response.error);
                            }
                          }, '书签已更新')
                        }
                      >
                        <option value={UNFILED_FOLDER_ID}>未分类</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      <button className="link-button" type="button" onClick={() => setEditingUrlId(isEditingUrl ? null : bookmark.id)}>
                        {isEditingUrl ? '收起链接' : '编辑链接'}
                      </button>
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => setEditingNoteId(editingNoteId === bookmark.id ? null : bookmark.id)}
                      >
                        {editingNoteId === bookmark.id ? '收起备注' : '备注'}
                      </button>
                      <a href={bookmark.url} target="_blank" rel="noreferrer">
                        打开
                      </a>
                      <button
                        className="link-button danger-text"
                        type="button"
                        onClick={() =>
                          run(async () => {
                            const response = await sendRuntimeMessage('DELETE_BOOKMARK', { bookmarkId: bookmark.id });
                            if (response.ok === false) {
                              throw new Error(response.error);
                            }
                          }, '书签已删除')
                        }
                      >
                        删除
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
