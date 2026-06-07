/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app',
        permanent: false,
        missing: [{ type: 'header', key: 'host', value: 'waybetter.nl' }],
      },
    ];
  },
};

export default nextConfig;
