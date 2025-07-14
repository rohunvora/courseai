import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

export interface UserAction {
  timestamp: string;
  action: string;
  details: any;
  sessionId?: string;
  courseId?: string;
  userAgent?: string;
  ip?: string;
}

class ActionLogger {
  private actions: UserAction[] = [];
  
  logAction(action: string, details: any, request?: FastifyRequest) {
    const userAction: UserAction = {
      timestamp: new Date().toISOString(),
      action,
      details,
      sessionId: details.sessionId,
      courseId: details.courseId,
      userAgent: request?.headers['user-agent'],
      ip: request?.ip || request?.socket?.remoteAddress,
    };
    
    this.actions.push(userAction);
    
    // Keep only last 100 actions to prevent memory issues
    if (this.actions.length > 100) {
      this.actions = this.actions.slice(-100);
    }
    
    // Log to console with clear formatting
    console.log('\n🎯 USER ACTION:', {
      timestamp: userAction.timestamp,
      action: userAction.action,
      details: userAction.details,
      session: userAction.sessionId,
      course: userAction.courseId,
    });
    
    // Also log to our structured logger
    logger.info('user_action', action, details.requestId || 'unknown', {
      action,
      details,
      sessionId: userAction.sessionId,
      courseId: userAction.courseId,
    });
  }
  
  getRecentActions(limit = 20): UserAction[] {
    return this.actions.slice(-limit);
  }
  
  getActionsBySession(sessionId: string): UserAction[] {
    return this.actions.filter(a => a.sessionId === sessionId);
  }
  
  clearActions() {
    this.actions = [];
  }
}

export const actionLogger = new ActionLogger();

// Middleware to log HTTP requests
export function actionLoggerMiddleware(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const startTime = Date.now();
  
  // Log request
  actionLogger.logAction('http_request', {
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    requestId: request.headers['x-request-id'] || `req-${Date.now()}`,
  }, request);
  
  // Log response when done
  reply.addHook('onSend', async (request, reply, payload) => {
    const duration = Date.now() - startTime;
    
    actionLogger.logAction('http_response', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      requestId: request.headers['x-request-id'] || `req-${Date.now()}`,
    }, request);
    
    return payload;
  });
  
  done();
}