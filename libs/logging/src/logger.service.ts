import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class AppLogger implements LoggerService {
  private format(level: string, message: string, params: unknown[]) {
    const ts = new Date().toISOString();
    if (params.length === 0) {
      return `[${ts}] [${level}] ${message}`;
    }
    return `[${ts}] [${level}] ${message} ${JSON.stringify(params)}`;
  }

  log(message: string, ...optionalParams: unknown[]) {
    process.stdout.write(this.format('INFO', message, optionalParams) + '\n');
  }

  error(message: string, ...optionalParams: unknown[]) {
    process.stderr.write(this.format('ERROR', message, optionalParams) + '\n');
  }

  warn(message: string, ...optionalParams: unknown[]) {
    process.stderr.write(this.format('WARN', message, optionalParams) + '\n');
  }

  debug?(message: string, ...optionalParams: unknown[]) {
    process.stdout.write(this.format('DEBUG', message, optionalParams) + '\n');
  }

  verbose?(message: string, ...optionalParams: unknown[]) {
    process.stdout.write(this.format('VERBOSE', message, optionalParams) + '\n');
  }
}
