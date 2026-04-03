import './globals.css';

export const metadata = {
  title: 'Waybetter. Made for agency people',
  description: 'Van aantekeningen naar briefing. In seconden.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="bg-warm text-text min-h-full flex flex-col">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
