import { useState, useEffect } from 'react'
import Chat from './components/Chat'
import './App.css'

function App() {
  const [courseId, setCourseId] = useState<string>('')
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)
  const [error, setError] = useState<string>('')

  // Create a demo course on app load
  useEffect(() => {
    createDemoCourse()
  }, [])

  const createDemoCourse = async () => {
    setIsCreatingCourse(true)
    setError('')

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course')
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
      <h1>Courses AI - Strength Training Coach</h1>
      <p className="status">Course ID: {courseId}</p>
      <Chat courseId={courseId} />
    </div>
  )
}

export default App