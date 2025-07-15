import { useState, useEffect } from 'react'
import Chat from './components/Chat'
import Journal from './components/Journal'
import PreviewTools from './components/PreviewTools'
import { actionTracker } from './utils/actionTracker'
import { callEdgeFunction } from './config/supabase'
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
      const data = await callEdgeFunction('createCourse', {
        topic: 'Strength Training for Beginners',
        currentLevel: 'beginner',
        goals: ['build muscle', 'improve form']
      })

      console.log('Course created:', data)
      
      if (!data.courseId) {
        throw new Error('No courseId returned from create course')
      }

      setCourseId(data.courseId)
      actionTracker.track('course_creation_success', {
        courseId: data.courseId,
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