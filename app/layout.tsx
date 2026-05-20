import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Echonomich - Kredi Kartı Kampanya Hesaplama Motoru',
  description: 'Echonomich ile harcamalarınızda en yüksek ödül, puan ve indirim kazandıran kredi kartı kampanyalarını anında görün.',
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
