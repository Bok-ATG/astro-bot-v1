// logging that doesn't suck and keeps secrets safe

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class Logger {
  constructor() {
    this.startTime = Date.now(); // when did we start this mess?
  }

  _formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  _sanitizeData(data) {
    if (typeof data === 'string') {
      // hide the secret sauce
      return data.replace(/sk-[a-zA-Z0-9]{48}/g, 'sk-***HIDDEN***')
                 .replace(/xox[a-z]-[a-zA-Z0-9-]+/g, 'xox*-***HIDDEN***')
                 .replace(/asst_[a-zA-Z0-9]+/g, 'asst_***HIDDEN***');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      const sensitiveFields = ['token', 'apiKey', 'api_key', 'secret', 'password', 'authorization'];
      
      for (const field of sensitiveFields) {
        if (sanitized[field]) {
          sanitized[field] = '***HIDDEN***'; // no peeking
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  info(message, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors.bright}INFO${colors.reset} ${message}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  success(message, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.green}[${timestamp}]${colors.reset} ${colors.bright}SUCCESS${colors.reset} ${message}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  warning(message, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.yellow}[${timestamp}]${colors.reset} ${colors.bright}WARNING${colors.reset} ${message}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  error(message, error = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.red}[${timestamp}]${colors.reset} ${colors.bright}ERROR${colors.reset} ${message}`);
    
    if (error) {
      if (error instanceof Error) {
        console.log(`${colors.dim}   └─ ${error.message}${colors.reset}`);
        if (error.stack) {
          console.log(`${colors.dim}   └─ Stack: ${error.stack}${colors.reset}`);
        }
      } else {
        const sanitized = this._sanitizeData(error);
        console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
      }
    }
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const timestamp = this._formatTime();
      console.log(`${colors.magenta}[${timestamp}]${colors.reset} ${colors.dim}DEBUG${colors.reset} ${message}`);
      
      if (data) {
        const sanitized = this._sanitizeData(data);
        console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
      }
    }
  }

  bot(botName, message, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.blue}[${timestamp}]${colors.reset} ${colors.bright}${botName.toUpperCase()}${colors.reset} ${message}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  slack(action, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors.bright}SLACK${colors.reset} ${action}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  openai(action, data = null) {
    const timestamp = this._formatTime();
    console.log(`${colors.green}[${timestamp}]${colors.reset} ${colors.bright}OPENAI${colors.reset} ${action}`);
    
    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(`${colors.dim}   └─ ${JSON.stringify(sanitized, null, 2)}${colors.reset}`);
    }
  }

  startup(message) {
    const timestamp = this._formatTime();
    console.log(`\n${colors.bright}${colors.green}[${timestamp}] ${message}${colors.reset}\n`);
  }

  separator() {
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  }
}

// Export singleton instance
module.exports = new Logger();
