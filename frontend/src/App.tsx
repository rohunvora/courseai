import { useState, useEffect } from 'react'
import Chat from './components/Chat'
import Journal from './components/Journal'
import PreviewTools from './components/PreviewTools'
import { actionTracker } from './utils/actionTracker'
import './App.css'

function App() {
  const [courseId, setCourseId] = useState<string>('')
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)
  const [error, setError] = useState<string>('')
  const [isJournalOpen, setIsJournalOpen] = useState(false)

  // Create a demo course on app load
  useEffect(() => {
    createDemoCourse()
  }, [])

  const createDemoCourse = async () => {
    setIsCreatingCourse(true)
    setError('')
    
    actionTracker.track('course_creation_start', {
      timestamp: new Date().toISOString(),
    })

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Strength Training for Beginners',
          currentLevel: 'beginner',
          goals: ['build muscle', 'improve form']
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create course')
      }

      setCourseId(data.data.id)
      actionTracker.track('course_creation_success', {
        courseId: data.data.id,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create course'
      setError(errorMessage)
      actionTracker.track('course_creation_error', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsCreatingCourse(false)
    }
  }

  if (isCreatingCourse) {
    return (
      <div className="container">
        <div className="loading">Creating your course...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          Error: {error}
          <br />
          <button onClick={createDemoCourse} style={{ marginTop: '10px' }}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!courseId) {
    return (
      <div className="container">
        <div className="loading">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <PreviewTools onReset={() => window.location.reload()} />
      
      <button 
        className="journal-toggle"
        onClick={() => {
          setIsJournalOpen(true)
          actionTracker.trackJournalOpen()
        }}
      >
        📋 Journal
      </button>
      
      <h1>Courses AI - Strength Training Coach</h1>
      <p className="status">Course ID: {courseId}</p>
      <Chat courseId={courseId} />
      
      <Journal 
        courseId={courseId}
        isOpen={isJournalOpen}
        onClose={() => {
          setIsJournalOpen(false)
          actionTracker.trackJournalClose()
        }}
      />
    </div>
  )
}

export default App