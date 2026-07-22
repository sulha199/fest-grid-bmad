import React from 'react';

export const metadata = {
  title: 'FestGrid',
  description: 'AI-Powered Music Festival Grid and Scheduler',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
