import { useState, useRef, useEffect } from 'react'
import { actionTracker } from '../utils/actionTracker'
import { callEdgeFunction, EDGE_FUNCTIONS } from '../config/supabase'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatProps {
  courseId: string
}

export default function Chat({ courseId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startSession()
  }, [courseId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const startSession = async () => {
    try {
      const data = await callEdgeFunction('createSession', {
        courseId,
        sessionType: 'practice',
        plannedDuration: 60
      })
      
      setSessionId(data.sessionId)
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    // Track user message
    actionTracker.trackChatMessage(userMessage.content, 'user')

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    // Create assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch(EDGE_FUNCTIONS.chatMessage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          courseId,
          message: userMessage.content,
          ...(sessionId && { sessionId }),
          context: {}
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let assistantContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Split by double newline to get complete SSE messages
        const parts = buffer.split('\n\n')
        
        // Keep the last part as it might be incomplete
        buffer = parts.pop() || ''
        
        // Process complete messages
        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim()
                if (jsonStr === '[DONE]') continue
                
                const data = JSON.parse(jsonStr)
                
                if (data.type === 'token' && data.content) {
                  assistantContent += data.content
                  
                  // Update the assistant message
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessageId 
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  )
                } else if (data.type === 'complete') {
                  // Stream completed successfully
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Stream error')
                }
              } catch (parseError) {
                // Only log if it's not an empty line or standard SSE comment
                if (jsonStr && !jsonStr.startsWith(':')) {
                  console.warn('Failed to parse SSE data:', parseError, 'Data:', jsonStr)
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      
      // Update assistant message with error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>AI Fitness Coach</h2>
        <p>Ask me about your workouts, form, or training questions!</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="status">
            Start a conversation by asking about your workout or fitness goals!
          </div>
        )}
        
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.type} ${isStreaming && message.type === 'assistant' && message === messages[messages.length - 1] ? 'streaming' : ''}`}
          >
            {message.content}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <div className="input-group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your workout..."
            disabled={isStreaming}
          />
          <button 
            onClick={sendMessage} 
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}