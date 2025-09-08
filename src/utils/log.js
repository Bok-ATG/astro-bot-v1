// logging utility with sensitive data protection

const config = require('../config');

// Minimal terminal color utility
const colorEnabled = process.stdout.isTTY && config.NODE_ENV !== 'production';
const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: (str) => colorEnabled ? `\x1b[36m${str}${color.reset}` : str,
  green: (str) => colorEnabled ? `\x1b[32m${str}${color.reset}` : str,
  yellow: (str) => colorEnabled ? `\x1b[33m${str}${color.reset}` : str,
  red: (str) => colorEnabled ? `\x1b[31m${str}${color.reset}` : str,
  magenta: (str) => colorEnabled ? `\x1b[35m${str}${color.reset}` : str,
  blue: (str) => colorEnabled ? `\x1b[34m${str}${color.reset}` : str,
  boldCyan: (str) => colorEnabled ? `${color.bold}\x1b[36m${str}${color.reset}` : str,
  boldGreen: (str) => colorEnabled ? `${color.bold}\x1b[32m${str}${color.reset}` : str,
  boldYellow: (str) => colorEnabled ? `${color.bold}\x1b[33m${str}${color.reset}` : str,
  boldRed: (str) => colorEnabled ? `${color.bold}\x1b[31m${str}${color.reset}` : str,
  boldBlue: (str) => colorEnabled ? `${color.bold}\x1b[34m${str}${color.reset}` : str,
  dimText: (str) => colorEnabled ? `${color.dim}${str}${color.reset}` : str,
  dimMagenta: (str) => colorEnabled ? `${color.dim}\x1b[35m${str}${color.reset}` : str,
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
