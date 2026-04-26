import {
  nextFolderPosition,
  normalizeUrl,
  sortBookmarks,
  sortFolders
} from '../lib/bookmarks.js';
import { DEFAULT_LIBRARY, UNFILED_FOLDER_ID } from '../lib/constants.js';
import { getSession, getSupabaseClient, signIn, signOut, signUp } from '../lib/supabase.js';
import { getStoredState, setStoredPartial } from '../lib/storage.js';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function normalizeFolderId(folderId) {
  return folderId === UNFILED_FOLDER_ID ? null : folderId ?? null;
}

function findBookmarkByUrl(bookmarks, url) {
  const normalized = normalizeUrl(url ?? '');
  return bookmarks.find((bookmark) => normalizeUrl(bookmark.url) === normalized) ?? null;
}

function isMissingFoldersTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes("could not find the table 'public.bookmark_folders'") || message.includes('bookmark_folders');
}

function isMissingNoteColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes("column 'note'") || message.includes('bookmarks.note') || message.includes('schema cache');
}

async function listBookmarks(client, userId) {
  const { data, error } = await client
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listFolders(client, userId) {
  const { data, error } = await client
    .from('bookmark_folders')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    if (isMissingFoldersTable(error)) {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

async function setBadgeForTab(tab) {
  if (!tab?.id) {
    return;
  }

  const { library } = await getStoredState();
  const isBookmarked = Boolean(findBookmarkByUrl(library.bookmarks, tab.url));
  await chrome.action.setBadgeText({ tabId: tab.id, text: isBookmarked ? '✓' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#18a957' });
}

async function refreshActiveTabBadge() {
  const tab = await getActiveTab();
  if (tab) {
    await setBadgeForTab(tab);
  }
}

async function ensureReady() {
  const state = await getStoredState();
  const hasConfig = Boolean(state.settings.supabaseUrl && state.settings.supabaseAnonKey);
  const session = await getSession().catch(() => state.session);

  return {
    ...state,
    session,
    hasConfig,
    isAuthed: Boolean(session?.user?.id)
  };
}

async function getAuthedClient() {
  const state = await ensureReady();
  if (!state.hasConfig) {
    throw new Error('请先在设置页确认 Supabase URL 和 anon key。');
  }
  if (!state.isAuthed) {
    throw new Error('请先登录后再收藏或编辑书签。');
  }

  const client = await getSupabaseClient();

  return { client, state, userId: state.session.user.id };
}

async function pullLibrary() {
  const ready = await ensureReady();
  if (!ready.isAuthed) {
    await setStoredPartial({ library: DEFAULT_LIBRARY });
    await refreshActiveTabBadge();
    return DEFAULT_LIBRARY;
  }

  const { client, userId } = await getAuthedClient();
  const [folders, bookmarks] = await Promise.all([
    listFolders(client, userId),
    listBookmarks(client, userId)
  ]);

  const library = {
    folders,
    bookmarks
  };

  await setStoredPartial({ library });
  await refreshActiveTabBadge();
  return library;
}

async function refreshState() {
  const [state, library] = await Promise.all([ensureReady(), pullLibrary().catch(() => null)]);
  return {
    ...(await ensureReady()),
    library: library ?? state.library
  };
}

async function createFolder(payload) {
  const { client, userId } = await getAuthedClient();
  const current = await pullLibrary();
  const now = new Date().toISOString();
  const folder = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: payload.name.trim(),
    position: nextFolderPosition(current.folders),
    created_at: now,
    updated_at: now
  };

  const { error } = await client.from('bookmark_folders').insert(folder);
  if (error) {
    if (isMissingFoldersTable(error)) {
      throw new Error('当前 Supabase 还没有 `bookmark_folders` 表，所以暂时不能新建文件夹。请先执行 README 里的建表 SQL。');
    }
    throw error;
  }

  await pullLibrary();
  return folder;
}

async function updateFolder(folderPatch) {
  const { client, userId } = await getAuthedClient();
  const updatePayload = {
    ...folderPatch,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('bookmark_folders')
    .update(updatePayload)
    .eq('id', folderPatch.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (isMissingFoldersTable(error)) {
      throw new Error('当前 Supabase 还没有 `bookmark_folders` 表，所以暂时不能编辑文件夹。请先执行 README 里的建表 SQL。');
    }
    throw error;
  }

  await pullLibrary();
  return data;
}

async function deleteFolder(folderId) {
  const { client, userId } = await getAuthedClient();
  const now = new Date().toISOString();

  const { error: moveError } = await client
    .from('bookmarks')
    .update({ folder_id: null, updated_at: now })
    .eq('folder_id', folderId)
    .eq('user_id', userId);
  if (moveError) {
    throw moveError;
  }

  const { error } = await client.from('bookmark_folders').delete().eq('id', folderId).eq('user_id', userId);
  if (error) {
    if (isMissingFoldersTable(error)) {
      throw new Error('当前 Supabase 还没有 `bookmark_folders` 表，所以暂时不能删除文件夹。请先执行 README 里的建表 SQL。');
    }
    throw error;
  }

  await pullLibrary();
}

async function upsertBookmark(bookmarkPatch) {
  const { client, userId } = await getAuthedClient();
  const current = await pullLibrary();
  const existing = bookmarkPatch.id
    ? current.bookmarks.find((bookmark) => bookmark.id === bookmarkPatch.id)
    : findBookmarkByUrl(current.bookmarks, bookmarkPatch.url);
  const now = new Date().toISOString();
  const folderId = normalizeFolderId(bookmarkPatch.folder_id);

  const bookmark = existing
    ? {
        ...existing,
        title: bookmarkPatch.title?.trim() || existing.title,
        url: normalizeUrl(bookmarkPatch.url?.trim() || existing.url),
        note: bookmarkPatch.note?.trim() ?? existing.note ?? '',
        folder_id: folderId,
        updated_at: now
      }
    : {
        id: bookmarkPatch.id ?? crypto.randomUUID(),
        user_id: userId,
        title: bookmarkPatch.title?.trim() || '未命名书签',
        url: normalizeUrl(bookmarkPatch.url?.trim() || ''),
        note: bookmarkPatch.note?.trim() ?? '',
        folder_id: folderId,
        created_at: now,
        updated_at: now
      };

  const { data, error } = await client.from('bookmarks').upsert(bookmark).select().single();
  if (error) {
    if (isMissingNoteColumn(error)) {
      throw new Error('当前 `bookmarks` 表还没有 `note` 字段。请在 Supabase 执行 README 里的 `alter table ... add column note` 语句。');
    }
    throw error;
  }

  await pullLibrary();
  return data;
}

async function deleteBookmark(bookmarkId) {
  const { client, userId } = await getAuthedClient();
  const { error } = await client.from('bookmarks').delete().eq('id', bookmarkId).eq('user_id', userId);
  if (error) {
    throw error;
  }
  await pullLibrary();
}

async function persistBookmarkPositions(bookmarks, folderId) {
  const { client } = await getAuthedClient();
  const updates = bookmarks.map((bookmark, index) => ({
    id: bookmark.id,
    user_id: bookmark.user_id,
    title: bookmark.title,
    url: bookmark.url,
    note: bookmark.note ?? '',
    folder_id: normalizeFolderId(folderId),
    position: index + 1,
    created_at: bookmark.created_at,
    updated_at: new Date().toISOString()
  }));

  if (updates.length === 0) {
    return;
  }

  const { error } = await client.from('bookmarks').upsert(updates);
  if (error) {
    if (isMissingNoteColumn(error)) {
      throw new Error('当前 `bookmarks` 表还没有 `note` 字段。请在 Supabase 执行 README 里的 `alter table ... add column note` 语句。');
    }
    throw error;
  }
}

async function moveBookmark({ bookmarkId, folderId, targetId }) {
  const current = await pullLibrary();
  const normalizedFolderId = normalizeFolderId(folderId);
  const moving = current.bookmarks.find((bookmark) => bookmark.id === bookmarkId);
  if (!moving) {
    throw new Error('找不到要移动的书签。');
  }

  const sourceFolderId = normalizeFolderId(moving.folder_id);
  const sourceItems = sortBookmarks(
    current.bookmarks.filter((bookmark) => normalizeFolderId(bookmark.folder_id) === sourceFolderId && bookmark.id !== bookmarkId)
  );
  const targetItemsBase = sortBookmarks(
    current.bookmarks.filter((bookmark) => normalizeFolderId(bookmark.folder_id) === normalizedFolderId && bookmark.id !== bookmarkId)
  );

  const targetItems = [...targetItemsBase];
  const insertAt =
    targetId && targetItemsBase.findIndex((bookmark) => bookmark.id === targetId) >= 0
      ? targetItemsBase.findIndex((bookmark) => bookmark.id === targetId)
      : targetItemsBase.length;

  targetItems.splice(insertAt, 0, { ...moving, folder_id: normalizedFolderId });

  await Promise.all([
    persistBookmarkPositions(sourceItems, sourceFolderId),
    persistBookmarkPositions(targetItems, normalizedFolderId)
  ]);
  await pullLibrary();
}

async function reorderFolders({ draggedId, targetId }) {
  const { client } = await getAuthedClient();
  const current = await pullLibrary();
  const fromIndex = current.folders.findIndex((folder) => folder.id === draggedId);
  const toIndex = current.folders.findIndex((folder) => folder.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return;
  }
  const reorderedBase = [...current.folders];
  const [dragged] = reorderedBase.splice(fromIndex, 1);
  reorderedBase.splice(toIndex, 0, dragged);
  const reordered = reorderedBase.map((folder, index) => ({
    ...folder,
    position: index + 1,
    updated_at: new Date().toISOString()
  }));

  const { error } = await client.from('bookmark_folders').upsert(reordered);
  if (error) {
    if (isMissingFoldersTable(error)) {
      throw new Error('当前 Supabase 还没有 `bookmark_folders` 表，所以暂时不能排序文件夹。请先执行 README 里的建表 SQL。');
    }
    throw error;
  }
  await pullLibrary();
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'open-manage',
    title: '打开书签管理',
    contexts: ['action']
  });
  chrome.contextMenus.create({
    id: 'open-settings',
    title: '打开设置',
    contexts: ['action']
  });
  await refreshActiveTabBadge();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'open-manage') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('manage.html') });
  }
  if (info.menuItemId === 'open-settings') {
    await chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-search') {
    return;
  }

  const tab = await getActiveTab();
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SEARCH_OVERLAY' }).catch(() => undefined);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await setBadgeForTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await setBadgeForTab({ ...tab, id: tabId });
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes['bookmarkflow.library'] || changes['bookmarkflow.session'])) {
    await refreshActiveTabBadge();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'GET_STATE') {
      sendResponse(await refreshState());
      return;
    }

    if (message.type === 'GET_POPUP_STATE') {
      const state = await refreshState();
      const tab = await getActiveTab();
      sendResponse({
        ...state,
        activeTab: tab ? { id: tab.id, title: tab.title ?? '', url: tab.url ?? '' } : null,
        currentBookmark: tab ? findBookmarkByUrl(state.library.bookmarks, tab.url) : null
      });
      return;
    }

    if (message.type === 'SAVE_SETTINGS') {
      const current = await getStoredState();
      await setStoredPartial({ settings: { ...current.settings, ...message.payload } });
      await getSession().catch(() => undefined);
      sendResponse(await refreshState());
      return;
    }

    if (message.type === 'AUTH_SIGN_UP') {
      await signUp(message.payload.email, message.payload.password);
      sendResponse(await refreshState());
      return;
    }

    if (message.type === 'AUTH_SIGN_IN') {
      await signIn(message.payload.email, message.payload.password);
      sendResponse(await refreshState());
      return;
    }

    if (message.type === 'AUTH_SIGN_OUT') {
      await signOut();
      await setStoredPartial({ library: DEFAULT_LIBRARY });
      await refreshActiveTabBadge();
      sendResponse(await ensureReady());
      return;
    }

    if (message.type === 'OPEN_EXTENSION_PAGE') {
      const page = message.payload?.page === 'manage' ? 'manage.html' : 'settings.html';
      await chrome.tabs.create({ url: chrome.runtime.getURL(page) });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'CREATE_FOLDER') {
      const folder = await createFolder(message.payload);
      sendResponse({ ok: true, folder });
      return;
    }

    if (message.type === 'UPDATE_FOLDER') {
      const folder = await updateFolder(message.payload);
      sendResponse({ ok: true, folder });
      return;
    }

    if (message.type === 'DELETE_FOLDER') {
      await deleteFolder(message.payload.folderId);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'UPSERT_BOOKMARK') {
      const bookmark = await upsertBookmark(message.payload);
      const activeTab = await getActiveTab();
      if (activeTab) {
        await setBadgeForTab(activeTab);
      }
      sendResponse({ ok: true, bookmark });
      return;
    }

    if (message.type === 'DELETE_BOOKMARK') {
      await deleteBookmark(message.payload.bookmarkId);
      const activeTab = await getActiveTab();
      if (activeTab) {
        await setBadgeForTab(activeTab);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'MOVE_BOOKMARK') {
      await moveBookmark(message.payload);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'REORDER_FOLDERS') {
      await reorderFolders(message.payload);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'OPEN_BOOKMARK') {
      if (message.payload.newTab) {
        await chrome.tabs.create({ url: message.payload.url });
      } else {
        const activeTab = await getActiveTab();
        if (activeTab?.id) {
          await chrome.tabs.update(activeTab.id, { url: message.payload.url });
        }
      }
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message type' });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || 'Unknown error' });
  });

  return true;
});
