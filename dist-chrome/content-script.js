// Content Script - 注入到每个页面

let searchBox = null;
let isVisible = false;

// 创建搜索框 DOM
function createSearchBox() {
  if (searchBox) return;
  
  searchBox = document.createElement('div');
  searchBox.id = 'bookmark-search-box';
  searchBox.innerHTML = `
    <div class="search-backdrop"></div>
    <div class="search-container">
      <div class="search-header">
        <input type="text" class="search-input" placeholder="搜索书签..." />
        <span class="search-hint">⌘+J 关闭</span>
      </div>
      <div class="search-results"></div>
      <div class="search-footer">
        <span>↑↓ 导航</span>
        <span>Enter 打开</span>
        <span>⌘+Enter 新标签页</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(searchBox);
  
  // 样式
  const style = document.createElement('style');
  style.textContent = `
    #bookmark-search-box {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #bookmark-search-box.visible {
      display: block;
    }
    .search-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
    .search-container {
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      max-width: 90%;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .search-header {
      display: flex;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 18px;
      padding: 8px;
      background: transparent;
    }
    .search-hint {
      font-size: 12px;
      color: #999;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .search-results {
      max-height: 400px;
      overflow-y: auto;
    }
    .search-result-item {
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.15s;
    }
    .search-result-item:hover,
    .search-result-item.active {
      background: #f0f9ff;
    }
    .search-result-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #e0e7ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .search-result-info {
      flex: 1;
      min-width: 0;
    }
    .search-result-title {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .search-result-url {
      font-size: 12px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .search-footer {
      display: flex;
      gap: 16px;
      padding: 12px 16px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    .search-empty {
      padding: 32px;
      text-align: center;
      color: #999;
    }
  `;
  document.head.appendChild(style);
  
  // 绑定事件
  const input = searchBox.querySelector('.search-input');
  const backdrop = searchBox.querySelector('.search-backdrop');
  
  backdrop.addEventListener('click', hideSearch);
  input.addEventListener('input', handleSearch);
  input.addEventListener('keydown', handleKeydown);
  
  // 聚焦到输入框
  setTimeout(() => input.focus(), 100);
}

// 加载书签
let allBookmarks = [];
async function loadBookmarks() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-bookmarks' });
    allBookmarks = response || [];
    renderResults(allBookmarks);
  } catch (e) {
    console.error('加载书签失败:', e);
  }
}

// 渲染搜索结果
function renderResults(bookmarks) {
  const resultsContainer = searchBox.querySelector('.search-results');
  
  if (bookmarks.length === 0) {
    resultsContainer.innerHTML = '<div class="search-empty">暂无书签</div>';
    return;
  }
  
  resultsContainer.innerHTML = bookmarks.slice(0, 10).map((bookmark, index) => `
    <div class="search-result-item" data-url="${bookmark.url}" data-index="${index}">
      <div class="search-result-icon">${bookmark.title?.[0] || '🔖'}</div>
      <div class="search-result-info">
        <div class="search-result-title">${bookmark.title}</div>
        <div class="search-result-url">${bookmark.url}</div>
      </div>
    </div>
  `).join('');
  
  // 绑定点击事件
  resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => openBookmark(item.dataset.url, false));
  });
}

// 搜索
function handleSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  
  if (!query) {
    renderResults(allBookmarks);
    return;
  }
  
  const filtered = allBookmarks.filter(b => 
    b.title?.toLowerCase().includes(query) || 
    b.url?.toLowerCase().includes(query)
  );
  
  renderResults(filtered);
}

// 键盘导航
let activeIndex = 0;
function handleKeydown(e) {
  const items = searchBox.querySelectorAll('.search-result-item');
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    updateActiveItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    updateActiveItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const url = items[activeIndex]?.dataset.url;
    if (url) {
      const isNewTab = e.metaKey || e.ctrlKey;
      openBookmark(url, isNewTab);
    }
  } else if (e.key === 'Escape') {
    hideSearch();
  }
}

function updateActiveItem(items) {
  items.forEach((item, i) => {
    item.classList.toggle('active', i === activeIndex);
  });
  items[activeIndex]?.scrollIntoView({ block: 'nearest' });
}

// 打开书签
async function openBookmark(url, newTab) {
  if (newTab) {
    chrome.runtime.sendMessage({ action: 'open-in-new-tab', url });
  } else {
    window.location.href = url;
  }
  hideSearch();
}

// 显示/隐藏搜索框
function toggleSearch() {
  if (!searchBox) {
    createSearchBox();
  }
  
  if (isVisible) {
    hideSearch();
  } else {
    showSearch();
  }
}

function showSearch() {
  searchBox.classList.add('visible');
  isVisible = true;
  
  // 清空搜索框
  const input = searchBox.querySelector('.search-input');
  input.value = '';
  activeIndex = 0;
  
  // 延迟聚焦，确保 DOM 渲染完成
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
  
  // 加载书签数据
  loadBookmarks();
}

function hideSearch() {
  searchBox.classList.remove('visible');
  isVisible = false;
  searchBox.querySelector('.search-input').value = '';
  activeIndex = 0;
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggle-search') {
    toggleSearch();
  }
});
