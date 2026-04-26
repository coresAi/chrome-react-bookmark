import { fuzzySearchBookmarks } from '../lib/bookmarks.js';
import { STORAGE_KEYS } from '../lib/constants.js';

const ROOT_ID = 'bookmarkflow-command-root';
let currentResults = [];
let selectedIndex = 0;
let latestLibrary = { bookmarks: [], folders: [] };

function removeOverlay() {
  document.getElementById(ROOT_ID)?.remove();
}

function openBookmark(item, newTab) {
  if (!item?.bookmark?.url) {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'OPEN_BOOKMARK',
    payload: {
      url: item.bookmark.url,
      newTab
    }
  });
}

function renderResults(container, query) {
  currentResults = fuzzySearchBookmarks(latestLibrary.bookmarks, latestLibrary.folders, query).slice(0, 8);
  selectedIndex = Math.min(selectedIndex, Math.max(currentResults.length - 1, 0));

  if (currentResults.length === 0) {
    container.innerHTML = '<div class="bf-empty">没有匹配到书签</div>';
    return;
  }

  container.innerHTML = currentResults
    .map(
      (item, index) => `
        <button class="bf-result ${index === selectedIndex ? 'is-active' : ''}" data-index="${index}">
          <span class="bf-result-main">
            <strong>${escapeHtml(item.bookmark.title)}</strong>
            <small>${escapeHtml(item.folderLabel)}</small>
          </span>
          <span class="bf-url">${escapeHtml(item.bookmark.url)}</span>
        </button>
      `
    )
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadLibrary() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.library);
  latestLibrary = data[STORAGE_KEYS.library] ?? latestLibrary;
}

async function showOverlay() {
  await loadLibrary();
  removeOverlay();

  const host = document.createElement('div');
  host.id = ROOT_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  shadow.innerHTML = `
    <style>
      .bf-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(8, 11, 20, 0.24);
        backdrop-filter: blur(12px);
        display: grid;
        place-items: center;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      }
      .bf-shell {
        width: min(680px, calc(100vw - 32px));
        border-radius: 26px;
        overflow: hidden;
        background: rgba(247, 245, 239, 0.98);
        color: #17212b;
        box-shadow: 0 20px 70px rgba(20, 30, 50, 0.28);
        border: 1px solid rgba(125, 118, 101, 0.18);
      }
      .bf-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(23, 33, 43, 0.08);
      }
      .bf-head input {
        width: 100%;
        border: 0;
        background: transparent;
        font-size: 24px;
        color: #17212b;
        outline: none;
      }
      .bf-head input::placeholder {
        color: rgba(23, 33, 43, 0.45);
      }
      .bf-list {
        padding: 10px;
        max-height: min(55vh, 500px);
        overflow: auto;
      }
      .bf-result {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
        padding: 14px 16px;
        border: 0;
        border-radius: 18px;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }
      .bf-result:hover,
      .bf-result.is-active {
        background: #17212b;
        color: #f8f4ea;
      }
      .bf-result-main {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .bf-result-main strong,
      .bf-url {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bf-result-main small {
        font-size: 12px;
        opacity: 0.7;
      }
      .bf-url {
        font-size: 12px;
        max-width: 240px;
        opacity: 0.74;
      }
      .bf-foot {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 18px 16px;
        color: rgba(23, 33, 43, 0.6);
        font-size: 12px;
      }
      .bf-empty {
        padding: 24px 14px 28px;
        text-align: center;
        color: rgba(23, 33, 43, 0.55);
      }
    </style>
    <div class="bf-backdrop">
      <div class="bf-shell">
        <div class="bf-head">
          <span>⌘J</span>
          <input type="text" placeholder="搜索书签标题、网址或文件夹" />
        </div>
        <div class="bf-list"></div>
        <div class="bf-foot">
          <span>Enter 打开</span>
          <span>⌘ + Enter 新标签页</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  `;

  const input = shadow.querySelector('input');
  const list = shadow.querySelector('.bf-list');
  const backdrop = shadow.querySelector('.bf-backdrop');

  renderResults(list, '');
  input.focus();

  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderResults(list, input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, Math.max(currentResults.length - 1, 0));
      renderResults(list, input.value);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults(list, input.value);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = currentResults[selectedIndex];
      if (item) {
        openBookmark(item, event.metaKey || event.ctrlKey);
        removeOverlay();
      }
    } else if (event.key === 'Escape') {
      removeOverlay();
    }
  });

  list.addEventListener('click', (event) => {
    const result = event.target.closest('.bf-result');
    if (!result) {
      return;
    }
    const index = Number(result.dataset.index);
    const item = currentResults[index];
    openBookmark(item, false);
    removeOverlay();
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      removeOverlay();
    }
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: '2147483647',
    padding: '12px 16px',
    borderRadius: '14px',
    background: '#17212b',
    color: '#f8f4ea',
    fontFamily: '"SF Pro Display", "PingFang SC", sans-serif',
    boxShadow: '0 12px 36px rgba(23, 33, 43, 0.28)'
  });
  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE_SEARCH_OVERLAY') {
    if (document.getElementById(ROOT_ID)) {
      removeOverlay();
    } else {
      showOverlay();
    }
  }

  if (message.type === 'SHOW_TOAST') {
    showToast(message.payload.message);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEYS.library]) {
    latestLibrary = changes[STORAGE_KEYS.library].newValue;
  }
});
