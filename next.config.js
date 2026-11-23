/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Carregado direto do node_modules no servidor (usa módulos nativos do Node, como perf_hooks)
    serverComponentsExternalPackages: ['prom-client'],
  },
}

module.exports = nextConfig
