'use client'

import { useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('active') // 'active' or 'planning'

  const sendMessage = async () => {
    if (!input) return
    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, mode })
    })
    const data = await response.json()
    setMessages([...newMessages, { role: 'assistant', content: data.response }])
  }

  return (
    <div className="chat-container">
      <h1>AI Coding Assistant</h1>
      <div>
        <label>Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="active">Active Development</option>
          <option value="planning">Planning</option>
        </select>
      </div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  )
}