import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Kredi Kartı Kampanya Hesaplama Motoru',
  description: 'Harcamalarınızda en yüksek ödül, puan ve indirim kazandıran kredi kartı kampanyalarını anında görün.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
