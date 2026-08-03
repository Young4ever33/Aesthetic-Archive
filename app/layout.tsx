import type { Metadata } from 'next';
import './globals.css';
import './marketing.css';

export const metadata: Metadata = {
  title: 'Aesthetic Archive',
  description: '给设计师的 AI 审美体系知识库。',
  icons: {
    icon: '/brand/archive-mark.svg',
    apple: '/brand/archive-mark.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
