import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrendPilot · 亚马逊选品情报工作台',
  description: '从数据采集、趋势分析、AI 评分到决策产出的亚马逊选品工作台。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
