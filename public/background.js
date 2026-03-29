const SUPABASE_TABLE = 'bookmarks';

let supabaseUrl = '';
let supabaseKey = '';
let supabaseTable = SUPABASE_TABLE;
let authToken = null;
let currentUserId = null;

async function loadSupabaseConfig() {
  const result = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'supabaseTable', 'supabaseAuthToken', 'supabaseUserId']);
  supabaseUrl = result.supabaseUrl || '';
  supabaseKey = result.supabaseKey || '';
  supabaseTable = result.supabaseTable || SUPABASE_TABLE;
  authToken = result.supabaseAuthToken || null;
  currentUserId = result.supabaseUserId || null;
  return { url: supabaseUrl, key: supabaseKey, table: supabaseTable };
}

async function saveSupabaseConfig(config) {
  supabaseUrl = config.url || '';
  supabaseKey = config.key || '';
  supabaseTable = config.table || SUPABASE_TABLE;
  
  await chrome.storage.local.set({
    supabaseUrl: config.url,
    supabaseKey: config.key,
    supabaseTable: config.table || SUPABASE_TABLE
  });
}

function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseKey);
}

async function supabaseRequest(endpoint, options = {}) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('未配置 Supabase');
  }

  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': supabaseKey,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=minimal'
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `请求失败: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login(email, password) {
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: '未配置 Supabase' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error_description || data.msg || '登录失败' };
    }

    authToken = data.access_token;
    currentUserId = data.user.id;
    await chrome.storage.local.set({ 
      supabaseAuthToken: authToken,
      supabaseUserId: currentUserId
    });

    return { success: true, user: data.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function logout() {
  authToken = null;
  currentUserId = null;
  await chrome.storage.local.remove(['supabaseAuthToken', 'supabaseUserId']);
  return { success: true };
}

async function register(email, password) {
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: '未配置 Supabase' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error_description || data.msg || '注册失败' };
    }

    if (data.confirmation_sent_at) {
      return { success: true, message: '注册成功！请检查邮箱确认链接' };
    }

    return { success: true, user: data.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function isLoggedIn() {
  await loadSupabaseConfig();
  return { loggedIn: !!authToken, userId: currentUserId };
}

async function checkSupabaseConnection() {
  if (!supabaseUrl || !supabaseKey) {
    return { connected: false, error: '未配置 Supabase' };
  }

  try {
    await supabaseRequest(`${supabaseTable}?select=id&limit=1`);
    return { connected: true };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-search') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle-search' });
    }
  }
});

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

  if (message.action === 'get-supabase-config') {
    loadSupabaseConfig().then(config => {
      sendResponse({ 
        configured: !!(config.url && config.key),
        url: config.url || '',
        table: config.table || SUPABASE_TABLE
      });
    });
    return true;
  }

  if (message.action === 'set-supabase-config') {
    saveSupabaseConfig(message.config).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'login') {
    loadSupabaseConfig().then(() => {
      login(message.email, message.password).then(sendResponse);
    });
    return true;
  }

  if (message.action === 'register') {
    loadSupabaseConfig().then(() => {
      register(message.email, message.password).then(sendResponse);
    });
    return true;
  }

  if (message.action === 'logout') {
    logout().then(sendResponse);
    return true;
  }

  if (message.action === 'get-login-status') {
    isLoggedIn().then(sendResponse);
    return true;
  }

  if (message.action === 'check-supabase-connection') {
    checkSupabaseConnection().then(sendResponse);
    return true;
  }
});

async function checkBookmarkStatus(url) {
  const bookmarks = await getBookmarks();
  const exists = bookmarks.some(b => b.url === url);
  return { exists, bookmark: bookmarks.find(b => b.url === url) };
}

async function getBookmarks() {
  await loadSupabaseConfig();
  
  if (isSupabaseConfigured() && authToken) {
    try {
      const data = await supabaseRequest(`${supabaseTable}?select=*&order=created_at.desc`);
      if (data) {
        return data.map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
          createdAt: b.created_at
        }));
      }
    } catch (e) {
      console.error('获取远程书签失败:', e);
    }
  }
  
  const result = await chrome.storage.local.get('bookmarks');
  return result.bookmarks || [];
}

async function addBookmark(bookmark) {
  await loadSupabaseConfig();
  
  const isConfigured = isSupabaseConfigured();
  const hasToken = !!authToken;
  const hasUserId = !!currentUserId;
  
  if (isConfigured && hasToken && hasUserId) {
    try {
      await supabaseRequest(supabaseTable, {
        method: 'POST',
        body: JSON.stringify([{
          title: bookmark.title,
          url: bookmark.url,
          user_id: currentUserId
        }])
      });
      
      const verify = await supabaseRequest(`${supabaseTable}?url=eq.${encodeURIComponent(bookmark.url)}&select=id`);
      
      if (verify && verify.length > 0) {
        await updateBadge(bookmark.url, true);
        return { success: true, source: 'supabase' };
      } else {
        return { success: false, message: 'RLS拒绝插入，请检查Supabase的RLS策略是否正确设置' };
      }
    } catch (e) {
      return { success: false, message: '错误: ' + e.message };
    }
  }
  
  return { 
    success: false, 
    message: '请先登录 Supabase 账户' + (isConfigured ? '' : '，并在设置中配置') + ' (状态: ' + 
      (isConfigured ? '已配置' : '未配置') + ', ' + 
      (hasToken ? '已登录' : '未登录') + ')'
  };
}

async function getLocalBookmarks() {
  const result = await chrome.storage.local.get('bookmarks');
  return result.bookmarks || [];
}

async function removeBookmark(url) {
  await loadSupabaseConfig();
  
  if (isSupabaseConfigured() && authToken) {
    try {
      await supabaseRequest(`${supabaseTable}?url=eq.${encodeURIComponent(url)}`, {
        method: 'DELETE'
      });
      
      await updateBadge(url, false);
      return { success: true, source: 'supabase' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  
  const bookmarks = await getLocalBookmarks();
  const filtered = bookmarks.filter(b => b.url !== url);
  await chrome.storage.local.set({ bookmarks: filtered });
  await updateBadge(url, false);
  
  return { success: true, source: 'local' };
}

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
