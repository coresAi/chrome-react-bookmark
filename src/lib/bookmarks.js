import { UNFILED_FOLDER_ID } from './constants.js';

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url;
  }
}

export function createBookmarkFromTab(tab, folderId = null) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: tab.title || tab.url || '未命名书签',
    url: normalizeUrl(tab.url || ''),
    note: '',
    folder_id: folderId,
    position: Date.now(),
    created_at: now,
    updated_at: now
  };
}

export function compareByPosition(a, b) {
  return (a.position ?? 0) - (b.position ?? 0);
}

export function sortBookmarks(bookmarks) {
  return [...bookmarks].sort(compareByPosition);
}

export function sortFolders(folders) {
  return [...folders].sort(compareByPosition);
}

export function getFolderLabel(folderId, folders) {
  if (!folderId) {
    return '未分类';
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? '未分类';
}

function scoreText(query, value) {
  if (!value) {
    return 0;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (normalizedValue === normalizedQuery) {
    return 120;
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return 80;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return 40;
  }

  let cursor = 0;
  let score = 0;
  for (const char of normalizedQuery) {
    const found = normalizedValue.indexOf(char, cursor);
    if (found === -1) {
      return 0;
    }
    score += 5;
    cursor = found + 1;
  }
  return score;
}

export function fuzzySearchBookmarks(bookmarks, folders, query) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return sortBookmarks(bookmarks).map((bookmark) => ({
      bookmark,
      score: 0,
      folderLabel: getFolderLabel(bookmark.folder_id, folders)
    }));
  }

  return bookmarks
    .map((bookmark) => {
      const folderLabel = getFolderLabel(bookmark.folder_id, folders);
      const score =
        scoreText(trimmed, bookmark.title) * 2 +
        scoreText(trimmed, bookmark.note) +
        scoreText(trimmed, bookmark.url) +
        scoreText(trimmed, folderLabel);

      return { bookmark, score, folderLabel };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || compareByPosition(left.bookmark, right.bookmark));
}

export function reorderItems(items, draggedId, targetId) {
  const ordered = [...items];
  const fromIndex = ordered.findIndex((item) => item.id === draggedId);
  const toIndex = ordered.findIndex((item) => item.id === targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const [dragged] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, dragged);

  return ordered.map((item, index) => ({
    ...item,
    position: index + 1,
    updated_at: item.updated_at ?? new Date().toISOString()
  }));
}

export function nextFolderPosition(folders) {
  return folders.reduce((max, folder) => Math.max(max, folder.position ?? 0), 0) + 1;
}

export function nextBookmarkPosition(bookmarks, folderId = null) {
  const scoped = bookmarks.filter((bookmark) => (bookmark.folder_id ?? null) === folderId);
  return scoped.reduce((max, bookmark) => Math.max(max, bookmark.position ?? 0), 0) + 1;
}

export function bookmarksForFolder(bookmarks, folderId) {
  if (folderId === UNFILED_FOLDER_ID) {
    return sortBookmarks(bookmarks.filter((bookmark) => !bookmark.folder_id));
  }

  return sortBookmarks(bookmarks.filter((bookmark) => bookmark.folder_id === folderId));
}
