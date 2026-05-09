'use client'

import { useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('active') // 'active' or 'planning'
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [localUrl, setLocalUrl] = useState('http://localhost:11434/v1')

  const sendMessage = async () => {
    if (!input) return
    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, mode, provider, apiKey, localUrl })
    })
    const data = await response.json()
    setMessages([...newMessages, { role: 'assistant', content: data.response }])
  }

  return (
    <div className="chat-container">
      <div className="header">
        <h1>AI Coding Assistant</h1>
        <div className="controls-row">
          <div className="control-group">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="select-input">
              <option value="active">Active Development</option>
              <option value="planning">Planning</option>
            </select>
          </div>
          <div className="control-group">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="select-input">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="local">Local Model</option>
            </select>
          </div>
        </div>
        <div className="control-group full-width">
          {provider === 'local' ? (
            <>
              <label>Local API URL</label>
              <input
                type="text"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="text-input"
              />
            </>
          ) : (
            <>
              <label>API Key <span className="optional">(Optional if in .env)</span></label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter ${provider} API Key`}
                className="text-input"
              />
            </>
          )}
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Start a conversation to get coding assistance!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message-wrapper ${msg.role}`}>
            <div className="message-bubble">
              <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
              <div className="message-content">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className="chat-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
    </div>
  )
}