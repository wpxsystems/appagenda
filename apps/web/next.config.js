/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  transpilePackages: ['@racket-app/shared', '@racket-app/ui'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
}

module.exports = nextConfig
