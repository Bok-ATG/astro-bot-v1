// logging utility with sensitive data protection

const config = require('../config');
const chalk = require('chalk');

class Logger {
  constructor() {
    this.startTime = Date.now(); // when did we start this mess?
    this.useJsonLogs = config.JSON_LOGS;

    // Configure chalk based on environment
    // Note: Chalk automatically detects TTY, but we can override for production
    if (config.NODE_ENV === 'production' || !process.stdout.isTTY) {
      chalk.level = 0; // Disable colors
    }
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
    console.log(`${chalk.cyan(`[${timestamp}]`)} ${levelColor(level)} ${message}`);

    if (data) {
      const sanitized = this._sanitizeData(data);
      console.log(chalk.dim(`   └─ ${JSON.stringify(sanitized, null, 2)}`));
    }
  }

  info(message, data = null) {
    this._logWithData('INFO', chalk.bold.cyan, message, data);
  }

  success(message, data = null) {
    this._logWithData('SUCCESS', chalk.bold.green, message, data);
  }

  warning(message, data = null) {
    this._logWithData('WARNING', chalk.bold.yellow, message, data);
  }

  error(message, error = null) {
    if (this.useJsonLogs) {
      this._logStructured('ERROR', message, null, error);
      return;
    }

    const timestamp = this._formatTime();
    console.log(`${chalk.cyan(`[${timestamp}]`)} ${chalk.bold.red('ERROR')} ${message}`);

    if (error) {
      if (error instanceof Error) {
        console.log(chalk.dim(`   └─ ${error.message}`));
        if (error.stack) {
          console.log(chalk.dim(`   └─ Stack: ${error.stack}`));
        }
      } else {
        const sanitized = this._sanitizeData(error);
        console.log(chalk.dim(`   └─ ${JSON.stringify(sanitized, null, 2)}`));
      }
    }
  }

  debug(message, data = null) {
    if (config.DEBUG) {
      this._logWithData('DEBUG', chalk.dim.magenta, message, data);
    }
  }

  bot(botName, message, data = null) {
    this._logWithData(botName.toUpperCase(), chalk.bold.blue, message, data);
  }

  slack(action, data = null) {
    this._logWithData('SLACK', chalk.bold.cyan, action, data);
  }

  openai(action, data = null) {
    this._logWithData('OPENAI', chalk.bold.green, action, data);
  }

  startup(message) {
    this.info(message);
  }

  separator() {
    if (this.useJsonLogs) {
      return;
    }
    console.log(chalk.dim('─'.repeat(60)));
  }
}

// Export singleton instance
module.exports = new Logger();
