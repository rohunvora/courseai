import { useState } from 'react';
import './PreviewTools.css';

interface PreviewToolsProps {
  onReset?: () => void;
}

export default function PreviewTools({ onReset }: PreviewToolsProps) {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  // Only show in preview environments
  const isPreview = import.meta.env.VITE_ENABLE_PREVIEW_FEATURES === 'true' || 
                    window.location.hostname.includes('vercel.app') ||
                    window.location.hostname.includes('preview');

  if (!isPreview) {
    return null;
  }

  const seedDemoData = async () => {
    setIsSeeding(true);
    setSeedResult(null);

    try {
      const adminToken = import.meta.env.VITE_ADMIN_TOKEN || prompt('Enter admin token:');
      if (!adminToken) {
        throw new Error('Admin token required');
      }

      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/admin/seed-demo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setSeedResult({
        success: true,
        message: 'Demo data seeded successfully!',
        data: data.data
      });

      // Optionally reset the app after seeding
      if (onReset) {
        setTimeout(() => {
          onReset();
        }, 2000);
      }

    } catch (error) {
      setSeedResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to seed demo data'
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="preview-tools">
      <div className="preview-tools-header">
        <span className="preview-badge">🔧 Preview Environment</span>
      </div>
      
      <button 
        className="seed-demo-button"
        onClick={seedDemoData}
        disabled={isSeeding}
      >
        {isSeeding ? '🔄 Seeding...' : '🌱 Reset & Seed Demo'}
      </button>

      {seedResult && (
        <div className={`seed-result ${seedResult.success ? 'success' : 'error'}`}>
          <p>{seedResult.message}</p>
          {seedResult.success && seedResult.data && (
            <div className="demo-credentials">
              <h4>Demo Users Created:</h4>
              {seedResult.data.users.map((user: any, index: number) => (
                <div key={index} className="demo-user">
                  <code>{user.email} / {user.password}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="preview-info">
        <p>This is a preview deployment. Data will be reset on each deployment.</p>
        <details>
          <summary>Testing Guide</summary>
          <ol>
            <li>Click "Reset & Seed Demo" to populate demo data</li>
            <li>Use the demo credentials to log in</li>
            <li>Test AI coaching with sample workouts</li>
            <li>Try progression suggestions (respects 10% rule)</li>
          </ol>
        </details>
      </div>
    </div>
  );
}