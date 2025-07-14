import { FastifyInstance } from 'fastify';
import { actionLogger } from '../middleware/actionLogger';

export async function monitorRoutes(fastify: FastifyInstance) {
  // Real-time monitoring dashboard
  fastify.get('/monitor/dashboard', async (request, reply) => {
    const recentActions = actionLogger.getRecentActions(50);
    
    // Generate HTML dashboard
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>CourseAI - Live Action Monitor</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0a0a; color: #fff; line-height: 1.6; 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px; text-align: center; 
        }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .stats { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px; padding: 20px; background: #111; 
        }
        .stat-card { 
            background: #222; padding: 20px; border-radius: 10px;
            border-left: 4px solid #667eea; 
        }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .stat-label { color: #aaa; text-transform: uppercase; font-size: 0.8em; }
        .actions { padding: 20px; }
        .action { 
            background: #111; margin-bottom: 10px; padding: 15px;
            border-radius: 8px; border-left: 3px solid #28a745;
            display: flex; justify-content: space-between; align-items: center;
        }
        .action.frontend { border-left-color: #17a2b8; }
        .action.error { border-left-color: #dc3545; }
        .action-time { color: #6c757d; font-family: monospace; }
        .action-type { 
            background: #28a745; color: white; padding: 2px 8px;
            border-radius: 4px; font-size: 0.8em; text-transform: uppercase;
        }
        .action-type.frontend { background: #17a2b8; }
        .action-type.error { background: #dc3545; }
        .action-details { font-family: monospace; color: #aaa; font-size: 0.9em; }
        .refresh-banner { 
            background: #28a745; color: white; padding: 10px; text-align: center;
            position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
        }
    </style>
    <script>
        // Auto-refresh every 2 seconds
        setTimeout(() => location.reload(), 2000);
    </script>
</head>
<body>
    <div class="refresh-banner">🔄 Auto-refreshing every 2 seconds | ${new Date().toISOString()}</div>
    
    <div class="header" style="margin-top: 40px;">
        <h1>🎯 CourseAI Live Monitor</h1>
        <p>Real-time action tracking and debugging dashboard</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${recentActions.length}</div>
            <div class="stat-label">Total Actions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${recentActions.filter(a => a.action.includes('frontend')).length}</div>
            <div class="stat-label">Frontend Actions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${recentActions.filter(a => a.action.includes('chat')).length}</div>
            <div class="stat-label">Chat Messages</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${recentActions.filter(a => a.action.includes('workout')).length}</div>
            <div class="stat-label">Workout Logs</div>
        </div>
    </div>
    
    <div class="actions">
        <h2>🕒 Recent Actions (Last 50)</h2>
        ${recentActions.slice().reverse().map(action => {
          const isFrontend = action.action.includes('frontend');
          const isError = action.action.includes('error');
          const time = new Date(action.timestamp).toLocaleTimeString();
          
          return `
            <div class="action ${isFrontend ? 'frontend' : ''} ${isError ? 'error' : ''}">
                <div>
                    <span class="action-type ${isFrontend ? 'frontend' : ''} ${isError ? 'error' : ''}">${action.action}</span>
                    <div class="action-details">${JSON.stringify(action.details, null, 0).substring(0, 100)}...</div>
                </div>
                <div class="action-time">${time}</div>
            </div>
          `;
        }).join('')}
    </div>
</body>
</html>`;
    
    reply.type('text/html').send(html);
  });
  
  // API endpoint for real-time action streaming
  fastify.get('/monitor/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    
    // Send initial actions
    const actions = actionLogger.getRecentActions(10);
    reply.raw.write(`data: ${JSON.stringify({ type: 'initial', actions })}\n\n`);
    
    // Set up interval to send updates
    const interval = setInterval(() => {
      const recentActions = actionLogger.getRecentActions(5);
      reply.raw.write(`data: ${JSON.stringify({ type: 'update', actions: recentActions })}\n\n`);
    }, 1000);
    
    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });
}