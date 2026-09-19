import { defineSecret, defineString } from 'firebase-functions/params';

export const GOOGLE_CLIENT_ID = defineString('GOOGLE_CLIENT_ID', { default: '' });
export const GOOGLE_REDIRECT_URI = defineString('GOOGLE_REDIRECT_URI', { default: '' });
export const DASHBOARD_URL = defineString('DASHBOARD_URL', { default: 'https://muone.live/dashboard' });
export const JEV_MODEL = defineString('JEV_MODEL', { default: 'jev-latest' });

export const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');
export const TOKEN_ENCRYPTION_KEY = defineSecret('TOKEN_ENCRYPTION_KEY');
export const EXPLABS_API_KEY = defineSecret('EXPLABS_API_KEY');
