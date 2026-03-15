// 监听快捷键
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-search') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle-search' });
    }
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check-bookmark') {
    checkBookmarkStatus(message.url).then(sendResponse);
    return true;
  }
  
  if (message.action === 'add-bookmark') {
    addBookmark(message.bookmark).then(sendResponse);
    return true;
  }
  
  if (message.action === 'remove-bookmark') {
    removeBookmark(message.url).then(sendResponse);
    return true;
  }
  
  if (message.action === 'get-bookmarks') {
    getBookmarks().then(sendResponse);
    return true;
  }
});

// 检查 URL 是否已收藏
async function checkBookmarkStatus(url) {
  const bookmarks = await getBookmarks();
  const exists = bookmarks.some(b => b.url === url);
  return { exists, bookmark: bookmarks.find(b => b.url === url) };
}

// 获取所有书签
async function getBookmarks() {
  const result = await chrome.storage.local.get('bookmarks');
  return result.bookmarks || [];
}

// 添加书签
async function addBookmark(bookmark) {
  const bookmarks = await getBookmarks();
  
  // 检查是否已存在
  if (bookmarks.some(b => b.url === bookmark.url)) {
    return { success: false, message: '已经收藏过啦' };
  }
  
  bookmarks.unshift({
    ...bookmark,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  });
  
  await chrome.storage.local.set({ bookmarks });
  
  // 更新 badge
  await updateBadge(bookmark.url, true);
  
  return { success: true };
}

// 删除书签
async function removeBookmark(url) {
  const bookmarks = await getBookmarks();
  const filtered = bookmarks.filter(b => b.url !== url);
  await chrome.storage.local.set({ bookmarks: filtered });
  
  // 更新 badge
  await updateBadge(url, false);
  
  return { success: true };
}

// 更新 badge 状态
async function updateBadge(url, isBookmarked) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url === url) {
    if (isBookmarked) {
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: tab.id });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }
  }
}

// 监听标签页更新，检查书签状态
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    const bookmarks = await getBookmarks();
    const isBookmarked = bookmarks.some(b => b.url === tab.url);
    
    if (isBookmarked) {
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
