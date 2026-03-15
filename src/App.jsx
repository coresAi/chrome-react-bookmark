import { useState, useEffect } from 'react'
import { Star, Trash2, Search, ExternalLink, Check } from 'lucide-react'
import Fuse from 'fuse.js'
import './App.css'

function App() {
  const [bookmarks, setBookmarks] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState({})
  const [message, setMessage] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    loadCurrentTab()
    loadBookmarks()
    loadVersion()
  }, [])

  // 获取版本号
  function loadVersion() {
    const root = document.getElementById('root')
    const v = root?.dataset?.version || '1.0.7'
    setVersion(v)
  }

  // 获取当前页面信息
  async function loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        setCurrentPage({
          url: tab.url,
          title: tab.title || '未命名'
        })
        
        // 检查是否已收藏
        const response = await chrome.runtime.sendMessage({ 
          action: 'check-bookmark', 
          url: tab.url 
        })
        if (response?.exists) {
          setMessage('✓ 已收藏')
          setTimeout(() => setMessage(''), 2000)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // 加载所有书签
  async function loadBookmarks() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get-bookmarks' })
      setBookmarks(response || [])
    } catch (e) {
      console.error(e)
    }
  }

  // 收藏当前页面
  async function addBookmark() {
    if (!currentPage.url) return
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'add-bookmark',
        bookmark: {
          title: currentPage.title,
          url: currentPage.url
        }
      })
      
      if (response.success) {
        setMessage('✓ 收藏成功')
        loadBookmarks()
      } else {
        setMessage(response.message || '收藏失败')
      }
      setTimeout(() => setMessage(''), 2000)
    } catch (e) {
      setMessage('收藏失败')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  // 删除书签
  async function removeBookmark(url) {
    try {
      await chrome.runtime.sendMessage({
        action: 'remove-bookmark',
        url
      })
      loadBookmarks()
    } catch (e) {
      console.error(e)
    }
  }

  // 打开书签
  function openBookmark(url, newTab = false) {
    if (newTab) {
      chrome.tabs.create({ url })
    } else {
      chrome.tabs.update({ url })
    }
  }

  // 搜索过滤
  const fuse = new Fuse(bookmarks, {
    keys: ['title', 'url'],
    threshold: 0.3
  })
  
  const filteredBookmarks = searchQuery 
    ? fuse.search(searchQuery).map(r => r.item)
    : bookmarks

  const isCurrentPageBookmarked = bookmarks.some(b => b.url === currentPage.url)

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>书签收藏夹</h1>
        {message && <span className="message">{message}</span>}
      </div>

      {/* 当前页面收藏按钮 */}
      <div className="current-page">
        <div className="current-info">
          <span className="current-title">{currentPage.title?.slice(0, 30)}</span>
          <span className="current-url">{currentPage.url?.slice(0, 40)}</span>
        </div>
        <button 
          className={`收藏按钮 ${isCurrentPageBookmarked ? 'bookmarked' : ''}`}
          onClick={addBookmark}
          disabled={isCurrentPageBookmarked}
        >
          {isCurrentPageBookmarked ? <Check size={18} /> : <Star size={18} />}
          {isCurrentPageBookmarked ? '已收藏' : '收藏'}
        </button>
      </div>

      {/* 搜索框 */}
      <div className="search-box">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="搜索书签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 书签列表 */}
      <div className="bookmark-list">
        {filteredBookmarks.length === 0 ? (
          <div className="empty">
            {searchQuery ? '没有找到匹配的书签' : '暂无收藏'}
          </div>
        ) : (
          filteredBookmarks.map((bookmark) => (
            <div 
              key={bookmark.id || bookmark.url}
              className="bookmark-item"
              onClick={() => openBookmark(bookmark.url)}
            >
              <div className="bookmark-icon">
                {bookmark.title?.[0] || '🔖'}
              </div>
              <div className="bookmark-info">
                <div className="bookmark-title">{bookmark.title}</div>
                <div className="bookmark-url">{bookmark.url}</div>
              </div>
              <div className="bookmark-actions">
                <button 
                  className="action-btn new-tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    openBookmark(bookmark.url, true)
                  }}
                  title="新标签页打开"
                >
                  <ExternalLink size={14} />
                </button>
                <button 
                  className="action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeBookmark(bookmark.url)
                  }}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="popup-footer">
        <span>按 <kbd>⌘</kbd>+<kbd>J</kbd> 快速搜索</span>
        {version && <span className="version">v{version}</span>}
      </div>
    </div>
  )
}

export default App
