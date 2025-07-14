import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  request_id: string;
  component: string;
  action: string;
  payload_summary?: any;
  level: 'info' | 'warn' | 'error' | 'debug';
}

class Logger {
  private logFile: string;

  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'app.log');
    this.ensureLogDir();
  }

  private ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private writeLog(entry: LogEntry) {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Console output
    console.log(logLine.trim());
    
    // File output
    fs.appendFileSync(this.logFile, logLine);
  }

  info(component: string, action: string, requestId: string, payloadSummary?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      component,
      action,
      payload_summary: payloadSummary,
      level: 'info',
    });
  }

  warn(component: string, action: string, requestId: string, payloadSummary?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      component,
      action,
      payload_summary: payloadSummary,
      level: 'warn',
    });
  }

  error(component: string, action: string, requestId: string, payloadSummary?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      component,
      action,
      payload_summary: payloadSummary,
      level: 'error',
    });
  }

  debug(component: string, action: string, requestId: string, payloadSummary?: any) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog({
        timestamp: new Date().toISOString(),
        request_id: requestId,
        component,
        action,
        payload_summary: payloadSummary,
        level: 'debug',
      });
    }
  }
}

export const logger = new Logger();