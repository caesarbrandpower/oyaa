import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Waybetter. Made for agency people',
  description: 'Van aantekeningen naar briefing. In seconden.',
  manifest: '/manifest.json',
  themeColor: '#0d0d0d',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Waybetter',
  },
};

export const viewport = {
  themeColor: '#0d0d0d',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-warm text-text min-h-full flex flex-col">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
