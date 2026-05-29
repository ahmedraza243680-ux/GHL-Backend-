import dotenv from 'dotenv';

dotenv.config();

function truthyEnv(name) {
  return String(process.env[name] ?? '').toLowerCase() === 'true';
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT) || 4000,
  MOCK_MODE: truthyEnv('MOCK_MODE'),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? '',
  GOOGLE_GBP_ACCOUNT_ID: process.env.GOOGLE_GBP_ACCOUNT_ID?.trim() ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  GHL_API_KEY: process.env.GHL_API_KEY ?? '',
  GHL_LOCATION_ID: process.env.GHL_LOCATION_ID ?? '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',
  ALERT_EMAIL_FROM: process.env.ALERT_EMAIL_FROM ?? '',
  ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO ?? '',
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER ?? '',
  /** Gmail app passwords may include spaces in .env — stripped when used */
  SMTP_PASS: String(process.env.SMTP_PASS ?? '').replace(/\s/g, ''),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
};

const REQUIRED_FOR_API = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
];

/**
 * Fail fast on boot if critical secrets / URLs are missing.
 */
export function validateServerEnv() {
  const missing = REQUIRED_FOR_API.filter((key) => !String(process.env[key] ?? '').trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing or empty environment variables: ${missing.join(', ')}. Copy .env and fill all values.`,
    );
  }
}
