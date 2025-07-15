// Mock API endpoints for Vercel preview deployments
// This provides demo functionality without a real backend

export default function handler(req, res) {
  const { method, url } = req;
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Mock course creation
  if (url === '/api/courses' && method === 'POST') {
    return res.status(200).json({
      success: true,
      data: {
        id: 'demo-course-' + Date.now(),
        title: 'Strength Training Demo',
        topic: req.body?.topic || 'Strength Training',
        createdAt: new Date().toISOString()
      }
    });
  }

  // Mock chat sessions
  if (url.startsWith('/api/chat/sessions') && method === 'POST') {
    return res.status(200).json({
      success: true,
      data: {
        id: 'demo-session-' + Date.now(),
        courseId: req.body?.courseId,
        status: 'active'
      }
    });
  }

  // Mock chat messages
  if (url.includes('/api/chat') && url.includes('/message') && method === 'POST') {
    // Simulate streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const message = req.body?.message || '';
    let response = '';
    
    // Generate demo responses based on input
    if (message.toLowerCase().includes('bench press')) {
      response = "Great job on your bench press workout! I see you completed 3 sets. That's solid work. Remember to maintain proper form - keep your feet planted, maintain a slight arch in your back, and control the bar on both the way down and up. Would you like me to log this workout for you?";
    } else if (message.toLowerCase().includes('increase') && message.toLowerCase().includes('%')) {
      response = "I understand you want to progress quickly, but safety is paramount. The 10% rule exists to prevent injury. Based on your last workout, I'd recommend increasing by no more than 5-10 lbs. This steady progression will help you build strength sustainably without risking injury.";
    } else if (message.toLowerCase().includes('hurt') || message.toLowerCase().includes('pain')) {
      response = "I'm concerned about the pain you're experiencing. It's important to distinguish between muscle soreness and potential injury. If you're feeling sharp pain, especially in joints, please stop immediately and consider seeing a medical professional. Rest is crucial for recovery.";
    } else {
      response = "I'm here to help with your fitness journey! You can tell me about your workouts, ask for advice on exercises, or discuss your training goals. For example, you could say 'I did squats today' or 'What's a good beginner routine?'";
    }
    
    // Simulate streaming
    const words = response.split(' ');
    let i = 0;
    
    const interval = setInterval(() => {
      if (i < words.length) {
        res.write(`data: {"content": "${words[i]} "}\n\n`);
        i++;
      } else {
        res.write('data: {"done": true}\n\n');
        clearInterval(interval);
        res.end();
      }
    }, 50);
    
    return;
  }

  // Mock admin seed endpoint
  if (url === '/api/admin/seed-demo' && method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization header'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Demo data seeded successfully (mock)',
      data: {
        users: [
          { email: 'demo@example.com', password: 'demo123', name: 'Demo User' },
          { email: 'test@example.com', password: 'test123', name: 'Test User' }
        ],
        stats: {
          progressLogs: 5,
          memories: 3,
          sessions: 2
        }
      }
    });
  }

  // Mock progress endpoint
  if (url.includes('/api/progress') && method === 'GET') {
    return res.status(200).json({
      success: true,
      data: {
        logs: [
          {
            id: '1',
            exercise: 'Bench Press',
            sets: 3,
            reps: [8, 8, 7],
            weight: [135, 135, 135],
            unit: 'lbs',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '2',
            exercise: 'Squat',
            sets: 3,
            reps: [5, 5, 5],
            weight: [185, 185, 185],
            unit: 'lbs',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    });
  }

  // Default 404
  return res.status(404).json({
    success: false,
    error: 'Endpoint not found in mock API'
  });
}