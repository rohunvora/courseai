import { useState, useEffect } from 'react'

interface ProgressLog {
  id: string
  activityType: string
  data: any
  timestamp: string
}

interface JournalProps {
  courseId: string
  isOpen: boolean
  onClose: () => void
}

export default function Journal({ courseId, isOpen, onClose }: JournalProps) {
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && courseId) {
      fetchRecentLogs()
    }
  }, [isOpen, courseId])

  const fetchRecentLogs = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Get recent progress logs via our existing backend endpoint
      const response = await fetch(`/api/progress/recent?courseId=${courseId}&limit=10`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch progress logs')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs || [])
      } else {
        throw new Error(data.error?.message || 'Failed to fetch logs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      console.error('Error fetching progress logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatLogSummary = (log: ProgressLog): string => {
    const data = log.data || {}
    
    if (log.activityType === 'exercise') {
      const exercise = data.exercise || 'Unknown exercise'
      const sets = data.sets || 0
      const reps = Array.isArray(data.reps) ? data.reps.join(',') : data.reps || '?'
      const weight = Array.isArray(data.weight) ? data.weight[0] : data.weight
      const unit = data.unit || 'lbs'
      
      if (weight) {
        return `${exercise} ${sets}x${reps} @ ${weight}${unit}`.substring(0, 60)
      } else {
        return `${exercise} ${sets}x${reps}`.substring(0, 60)
      }
    }
    
    return `${log.activityType} activity`.substring(0, 60)
  }

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) {
      return 'Just now'
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffHours < 48) {
      return 'Yesterday'
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    }
  }

  if (!isOpen) return null

  return (
    <div className="journal-overlay">
      <div className="journal-drawer">
        <div className="journal-header">
          <h3>Recent Activity</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="journal-content">
          {loading && (
            <div className="journal-loading">Loading recent activity...</div>
          )}
          
          {error && (
            <div className="journal-error">
              {error}
              <button onClick={fetchRecentLogs} className="retry-button">
                Retry
              </button>
            </div>
          )}
          
          {!loading && !error && logs.length === 0 && (
            <div className="journal-empty">
              No recent activity found. Start logging your workouts!
            </div>
          )}
          
          {!loading && !error && logs.length > 0 && (
            <div className="journal-logs">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="log-date">{formatDate(log.timestamp)}</td>
                      <td className="log-type">{log.activityType}</td>
                      <td className="log-summary">{formatLogSummary(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}