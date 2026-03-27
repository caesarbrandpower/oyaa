import './globals.css';

export const metadata = {
  title: 'Oyaa.',
  description: 'Van gesprek naar geregeld, in minuten.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="bg-white text-text min-h-full flex flex-col">
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
