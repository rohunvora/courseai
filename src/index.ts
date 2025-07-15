import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env.js';
import { chatRoutes } from './routes/chat.js';
import { chatRoutesWithTools } from './routes/chat-tools.js';
import { courseRoutes } from './routes/courses.js';
import { progressRoutes } from './routes/progress.js';
import { authRoutes } from './routes/auth.js';
import { demoRoutes } from './routes/demo.js';
import { actionRoutes } from './routes/actions.js';
import { monitorRoutes } from './routes/monitor.js';
import { sessionRoutes } from './routes/sessions.js';
import experimentsRoutes from './routes/experiments.js';
import { adminRoutes } from './routes/admin.js';
import { actionLoggerMiddleware } from './middleware/actionLogger.js';
import { setupErrorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { startQualityMonitoring } from './services/quality-monitor.js';

const fastify = Fastify({
  logger: {
    level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

// Start server
const start = async () => {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-frontend-domain.com'] 
        : true,
      credentials: true,
    });
    
    // Add action logging middleware
    fastify.addHook('preHandler', actionLoggerMiddleware);

    // Health check
    fastify.get('/health', async (request, _reply) => {
      const requestId = (request.headers['x-request-id'] as string) || 'health-check';
      logger.info('server', 'health_check', requestId);
      
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        requestId 
      };
    });

    // Simple test endpoint
    fastify.get('/api/test', async (request, _reply) => {
      const requestId = (request.headers['x-request-id'] as string) || 'test-endpoint';
      logger.info('server', 'test_endpoint', requestId);
      
      return { 
        message: 'Hello from Courses AI! 👋',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        requestId,
      };
    });

    // Register routes
    await fastify.register(authRoutes);
    
    // Use function calling if enabled
    if (config.features.functionCalling) {
      await fastify.register(chatRoutesWithTools);
      console.log('✨ Function calling enabled for chat');
    } else {
      await fastify.register(chatRoutes);
    }
    
    await fastify.register(courseRoutes);
    await fastify.register(progressRoutes);
    await fastify.register(sessionRoutes);
    await fastify.register(actionRoutes);
    await fastify.register(monitorRoutes);
    await fastify.register(experimentsRoutes);
    await fastify.register(demoRoutes);
    await fastify.register(adminRoutes);

    // Setup error handler with traceable error IDs
    setupErrorHandler(fastify);

    const port = config.server.port;
    const host = config.server.nodeEnv === 'production' ? '0.0.0.0' : 'localhost';
    
    await fastify.listen({ port, host });
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CourseAI Backend Server Started!');
    console.log('='.repeat(60));
    console.log(`📡 Server: http://${host}:${port}`);
    console.log(`❤️  Health: http://${host}:${port}/health`);
    console.log(`🧪 Test: http://${host}:${port}/api/test`);
    console.log(`📊 Monitor: http://${host}:${port}/monitor/dashboard`);
    console.log(`🎯 Actions: http://${host}:${port}/api/actions/recent`);
    console.log('='.repeat(60));
    console.log('🔍 MONITORING: All user actions will be logged here');
    console.log('✨ FUNCTION CALLING:', config.features.functionCalling ? 'ENABLED' : 'DISABLED');
    console.log('='.repeat(60) + '\n');
    
    // Start quality monitoring
    startQualityMonitoring();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();