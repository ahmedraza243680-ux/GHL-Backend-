import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.resolve(__dirname, '../../logs');
const logFilePath = path.join(logsDir, 'server.log');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const stream = fs.createWriteStream(logFilePath, { flags: 'a' });

function formatArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function writeToFile(level, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(formatArg).join(' ');
  stream.write(`[${timestamp}] [${level}] ${message}\n`);
}

const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

console.log = (...args) => {
  original.log(...args);
  writeToFile('LOG', args);
};

console.info = (...args) => {
  original.info(...args);
  writeToFile('INFO', args);
};

console.warn = (...args) => {
  original.warn(...args);
  writeToFile('WARN', args);
};

console.error = (...args) => {
  original.error(...args);
  writeToFile('ERROR', args);
};

console.debug = (...args) => {
  original.debug(...args);
  writeToFile('DEBUG', args);
};

export const logger = {
  log: (...args) => console.log(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => console.debug(...args),
  filePath: logFilePath,
};

export default logger;
