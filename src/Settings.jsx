import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Check, X, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import './App.css'

function Settings({ onBack }) {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [supabaseTable, setSupabaseTable] = useState('bookmarks')
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [loginStatus, setLoginStatus] = useState(null)
  const [userEmail, setUserEmail] = useState('')

  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get-supabase-config' })
      if (response) {
        setSupabaseUrl(response.url || '')
        setSupabaseTable(response.table || 'bookmarks')
        if (response.configured) {
          setConnected(response.configured)
        }
      }
    } catch {
      console.error()
    }
  }

  async function checkLoginStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get-login-status' })
      if (response) {
        setLoginStatus(response.loggedIn)
        setUserEmail(response.email || '')
      }
    } catch {
      console.error()
    }
  }

  async function testConnection() {
    if (!supabaseUrl || !supabaseKey) {
      setMessage('请先填写 URL 和 Key')
      return
    }
    
    setTesting(true)
    setMessage('')
    
    try {
      await chrome.runtime.sendMessage({
        action: 'set-supabase-config',
        config: { url: supabaseUrl, key: supabaseKey, table: supabaseTable }
      })
      
      const response = await chrome.runtime.sendMessage({ action: 'check-supabase-connection' })
      
      if (response?.connected) {
        setConnected(true)
        setMessage('✓ 连接成功!')
      } else {
        setConnected(false)
        setMessage('✗ 连接失败: ' + (response?.error || '未知错误'))
      }
    } catch (e) {
      setConnected(false)
      setMessage('✗ 连接失败: ' + e.message)
    }
    
    setTesting(false)
  }

  async function saveConfig() {
    if (!supabaseUrl || !supabaseKey) {
      setMessage('请填写 URL 和 Key')
      return
    }
    
    try {
      await chrome.runtime.sendMessage({
        action: 'set-supabase-config',
        config: { url: supabaseUrl, key: supabaseKey, table: supabaseTable }
      })
      setMessage('✓ 配置已保存!')
      setTimeout(() => setMessage(''), 2000)
    } catch (e) {
      setMessage('保存失败: ' + e.message)
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setMessage('请填写邮箱和密码')
      return
    }
    
    setLoggingIn(true)
    setMessage('')
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'login',
        email,
        password
      })
      
      if (response?.success) {
        setLoginStatus(true)
        setUserEmail(email)
        setMessage('✓ 登录成功!')
        setEmail('')
        setPassword('')
      } else {
        setMessage('✗ 登录失败: ' + (response?.error || '未知错误'))
      }
    } catch (e) {
      setMessage('✗ 登录失败: ' + e.message)
    }
    
    setLoggingIn(false)
  }

  async function handleLogout() {
    try {
      await chrome.runtime.sendMessage({ action: 'logout' })
      setLoginStatus(false)
      setUserEmail('')
      setMessage('✓ 已退出登录')
      setTimeout(() => setMessage(''), 2000)
    } catch (e) {
      setMessage('退出失败: ' + e.message)
    }
  }

  async function handleRegister() {
    if (!email || !password) {
      setMessage('请填写邮箱和密码')
      return
    }
    if (password !== confirmPassword) {
      setMessage('两次密码不一致')
      return
    }
    if (password.length < 6) {
      setMessage('密码至少6位')
      return
    }
    
    setLoggingIn(true)
    setMessage('')
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'register',
        email,
        password
      })
      
      if (response?.success) {
        setMessage('✓ 注册成功！请登录')
        setIsRegistering(false)
        setPassword('')
        setConfirmPassword('')
      } else {
        setMessage('✗ 注册失败: ' + (response?.error || '未知错误'))
      }
    } catch (e) {
      setMessage('✗ 注册失败: ' + e.message)
    }
    
    setLoggingIn(false)
  }

  useEffect(() => {
    loadConfig()
    checkLoginStatus()
  }, [])

  return (
    <div className="popup">
      <div className="popup-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1>设置</h1>
      </div>

      <div className="settings-section">
        <h2>Supabase 配置</h2>
        <p className="help-text">在 Supabase 创建表后，填写下方配置信息</p>
        
        <div className="form-group">
          <label>Supabase URL</label>
          <input
            type="url"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="https://xxx.supabase.co"
          />
        </div>
        
        <div className="form-group">
          <label>Supabase Key (anon public)</label>
          <div className="input-with-icon">
            <input
              type={showKey ? 'text' : 'password'}
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            <button 
              className="icon-btn"
              onClick={() => setShowKey(!showKey)}
              type="button"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label>表名 (可选)</label>
          <input
            type="text"
            value={supabaseTable}
            onChange={(e) => setSupabaseTable(e.target.value)}
            placeholder="bookmarks"
          />
        </div>

        <div className="button-row">
          <button 
            className="btn secondary" 
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button 
            className="btn primary" 
            onClick={saveConfig}
          >
            保存配置
          </button>
        </div>
        
        {message && <div className={`message ${message.includes('✗') ? 'error' : 'success'}`}>{message}</div>}
        
        {connected && (
          <div className="status connected">
            <Check size={14} /> 已连接到 Supabase
          </div>
        )}
      </div>

      <div className="settings-section">
        <h2>{isRegistering ? '注册' : '登录'}</h2>
        <p className="help-text">
          {loginStatus 
            ? `已登录: ${userEmail}` 
            : isRegistering 
              ? '注册新账户以同步书签到云端'
              : '登录以同步书签到云端'}
        </p>
        
        {loginStatus ? (
          <button className="btn danger" onClick={handleLogout}>
            退出登录
          </button>
        ) : (
          <>
            <div className="form-group">
              <label>邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            
            <div className="form-group">
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <label>确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
            
            <button 
              className="btn primary" 
              onClick={isRegistering ? handleRegister : handleLogin}
              disabled={loggingIn}
            >
              {loggingIn ? (isRegistering ? '注册中...' : '登录中...') : (isRegistering ? '注册' : '登录')}
            </button>

            <div className="auth-switch">
              {isRegistering ? (
                <span onClick={() => { setIsRegistering(false); setMessage('') }}>
                  已有账户？<a>登录</a>
                </span>
              ) : (
                <span onClick={() => { setIsRegistering(true); setMessage('') }}>
                  没有账户？<a>注册</a>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="settings-section">
        <h2>使用说明</h2>
        <ol className="help-list">
          <li>在 Supabase 创建项目</li>
          <li>创建 <code>bookmarks</code> 表，包含字段: <code>id</code>, <code>title</code>, <code>url</code>, <code>user_id</code>, <code>created_at</code></li>
          <li>启用 RLS 策略，允许已认证用户 CRUD</li>
          <li>在上方填写 URL 和 Key</li>
          <li>点击测试连接，成功后保存</li>
          <li>注册或登录账户后即可同步书签</li>
        </ol>
      </div>
    </div>
  )
}

export default Settings
