/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['winston', 'winston-daily-rotate-file'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      };

      // Handle "node:" scheme by stripping the prefix
      config.plugins.push(
        new (class NodeSchemePlugin {
          apply(compiler) {
            compiler.resolverFactory.hooks.resolver.for('normal').tap('NodeSchemePlugin', (resolver) => {
              resolver.getHook('resolve').tapAsync('NodeSchemePlugin', (request, resolveContext, callback) => {
                if (request.request && request.request.startsWith('node:')) {
                  request.request = request.request.replace(/^node:/, '');
                }
                callback();
              });
            });
          }
        })()
      );
    }
    return config;
  },
}

export default nextConfig
