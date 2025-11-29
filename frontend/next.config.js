const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://api.sistemasnettsistemas.com.br/api'
  : 'http://localhost:3001/api');

const DEFAULT_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || DEFAULT_API_URL.replace(/\/api$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || DEFAULT_SOCKET_URL,
    NEXT_PUBLIC_API_URL: DEFAULT_API_URL,
    NEXT_PUBLIC_SOCKET_URL: DEFAULT_SOCKET_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Disparador NettSistemas',
    NEXT_PUBLIC_DISABLE_FRONTEND_LOGS: process.env.NEXT_PUBLIC_DISABLE_FRONTEND_LOGS || 'true',
    NEXT_PUBLIC_ENABLE_LANDING_PAGE: process.env.NEXT_PUBLIC_ENABLE_LANDING_PAGE || 'true',
    NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP || 'false',
  },
  images: {
    domains: ['localhost', DEFAULT_SOCKET_URL.replace(/^https?:\/\//, ''), 'api.sistemasnettsistemas.com.br', 'sistemasnettsistemas.com.br'],
  },
};

module.exports = nextConfig;
