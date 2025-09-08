// logging utility with sensitive data protection

const config = require('../config');

// Minimal terminal color utility
const colorEnabled = process.stdout.isTTY && config.NODE_ENV !== 'production';

// ANSI escape codes as constants
const ANSI_RESET = "\x1b[0m";
const ANSI_BOLD = "\x1b[1m";
const ANSI_DIM = "\x1b[2m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RED = "\x1b[31m";
const ANSI_MAGENTA = "\x1b[35m";
const ANSI_BLUE = "\x1b[34m";

const color = {
  reset: ANSI_RESET,
  bold: ANSI_BOLD,
  dim: ANSI_DIM,
  cyan: (str) => colorEnabled ? `${ANSI_CYAN}${str}${ANSI_RESET}` : str,
  green: (str) => colorEnabled ? `${ANSI_GREEN}${str}${ANSI_RESET}` : str,
  yellow: (str) => colorEnabled ? `${ANSI_YELLOW}${str}${ANSI_RESET}` : str,
  red: (str) => colorEnabled ? `${ANSI_RED}${str}${ANSI_RESET}` : str,
  magenta: (str) => colorEnabled ? `${ANSI_MAGENTA}${str}${ANSI_RESET}` : str,
  blue: (str) => colorEnabled ? `${ANSI_BLUE}${str}${ANSI_RESET}` : str,
  boldCyan: (str) => colorEnabled ? `${ANSI_BOLD}${ANSI_CYAN}${str}${ANSI_RESET}` : str,
  boldGreen: (str) => colorEnabled ? `${ANSI_BOLD}${ANSI_GREEN}${str}${ANSI_RESET}` : str,
  boldYellow: (str) => colorEnabled ? `${ANSI_BOLD}${ANSI_YELLOW}${str}${ANSI_RESET}` : str,
  boldRed: (str) => colorEnabled ? `${ANSI_BOLD}${ANSI_RED}${str}${ANSI_RESET}` : str,
  boldBlue: (str) => colorEnabled ? `${ANSI_BOLD}${ANSI_BLUE}${str}${ANSI_RESET}` : str,
  dimText: (str) => colorEnabled ? `${ANSI_DIM}${str}${ANSI_RESET}` : str,
  dimMagenta: (str) => colorEnabled ? `${ANSI_DIM}${ANSI_MAGENTA}${str}${ANSI_RESET}` : str,
};

class Logger {
  constructor() {
    this.startTime = Date.now(); // when did we start this mess?
    this.useJsonLogs = config.JSON_LOGS;
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

  _logStructured(level, message, data = null, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(data && { data: this._sanitizeData(data) }),
      ...(error && {
        error: error instanceof Error
          ? { message: error.message, stack: error.stack }
          : this._sanitizeData(error)
      })
    };

    console.log(JSON.stringify(logEntry));
  }

  _logWithData(level, levelColor, message, data = null) {
    if (this.useJsonLogs) {
      this._logStructured(level, message, data);
      return;
    }

    const timestamp = this._formatTime();

    console.log(`${color.cyan(`[${timestamp}]`)} ${levelColor(level)} ${message}`);

    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(color.dimText(`   └─ ${JSON.stringify(sanitized, null, 2)}`));
    }
  }

  info(message, data = null) {
    this._logWithData('INFO', color.boldCyan, message, data);
  }

  success(message, data = null) {
    this._logWithData('SUCCESS', color.boldGreen, message, data);
  }

  warning(message, data = null) {
    this._logWithData('WARNING', color.boldYellow, message, data);
  }

  error(message, error = null) {
    if (this.useJsonLogs) {
      this._logStructured('ERROR', message, null, error);
      return;
    }

    const timestamp = this._formatTime();
    console.log(`${color.cyan(`[${timestamp}]`)} ${color.boldRed('ERROR')} ${message}`);

    if (error) {
      if (error instanceof Error) {
        console.log(color.dimText(`   └─ ${error.message}`));
        if (error.stack) {
          console.log(color.dimText(`   └─ Stack: ${error.stack}`));
        }
      } else {
        const sanitized = this._sanitizeData(error);
        console.log(color.dimText(`   └─ ${JSON.stringify(sanitized, null, 2)}`));
      }
    }
  }

  debug(message, data = null) {
    if (config.DEBUG) {
      this._logWithData('DEBUG', color.dimMagenta, message, data);
    }
  }

  bot(botName, message, data = null) {
    this._logWithData(botName.toUpperCase(), color.boldBlue, message, data);
  }

  slack(action, data = null) {
    this._logWithData('SLACK', color.boldCyan, action, data);
  }

  openai(action, data = null) {
    this._logWithData('OPENAI', color.boldGreen, action, data);
  }

  startup(message) {
    this.info(message);
  }

  separator() {
    if (this.useJsonLogs) {
      return;
    }
    console.log(color.dimText('─'.repeat(60)));
  }
}

// Export singleton instance
module.exports = new Logger();
