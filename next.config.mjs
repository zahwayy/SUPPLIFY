/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pg and bcryptjs external on the server bundle
  serverExternalPackages: ['pg', 'bcryptjs'],
};

export default nextConfig;
