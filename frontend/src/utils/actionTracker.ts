// Frontend action tracking utility

interface FrontendAction {
  timestamp: string;
  action: string;
  details: any;
  url: string;
  userAgent: string;
}

class ActionTracker {
  private sessionId: string;
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.trackPageLoad();
    this.setupGlobalTracking();
  }
  
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private trackPageLoad() {
    this.track('page_load', {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
    });
  }
  
  private setupGlobalTracking() {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.track('click', {
        element: target.tagName,
        className: target.className,
        id: target.id,
        text: target.textContent?.substring(0, 50),
        x: event.clientX,
        y: event.clientY,
      });
    });
    
    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.track('form_submit', {
        formId: form.id,
        formClassName: form.className,
        action: form.action,
      });
    });
    
    // Track input changes
    document.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.type !== 'password') {
        this.track('input_change', {
          inputId: input.id,
          inputType: input.type,
          placeholder: input.placeholder,
          valueLength: input.value.length,
        });
      }
    });
    
    // Track keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        this.track('keyboard_shortcut', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        });
      }
    });
  }
  
  track(action: string, details: any = {}) {
    const actionData: FrontendAction = {
      timestamp: new Date().toISOString(),
      action,
      details: {
        ...details,
        sessionId: this.sessionId,
      },
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    
    // Log to console for debugging
    console.log('🎭 FRONTEND ACTION:', actionData);
    
    // Send to backend
    this.sendToBackend(actionData);
  }
  
  private async sendToBackend(actionData: FrontendAction) {
    // TODO: Implement action tracking with Supabase
    // For now, just log to console
    return;
  }
  
  // Specific tracking methods for key app actions
  trackChatMessage(message: string, messageType: 'user' | 'assistant') {
    this.track('chat_message', {
      messageType,
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    });
  }
  
  trackJournalOpen() {
    this.track('journal_open', {
      timestamp: new Date().toISOString(),
    });
  }
  
  trackJournalClose() {
    this.track('journal_close', {
      timestamp: new Date().toISOString(),
    });
  }
  
  trackWorkoutLogged(workoutData: any) {
    this.track('workout_logged', {
      ...workoutData,
      timestamp: new Date().toISOString(),
    });
  }
  
  trackToolUsage(toolName: string, result: any) {
    this.track('tool_usage', {
      toolName,
      success: result.success,
      timestamp: new Date().toISOString(),
    });
  }
}

export const actionTracker = new ActionTracker();