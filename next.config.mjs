/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pg and bcryptjs external on the server bundle
  serverExternalPackages: ['pg', 'bcryptjs'],
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
