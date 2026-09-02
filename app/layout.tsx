import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '复盘台 · 交易复盘工作台',
  description: '沉淀每一次交易，识别真正有效的交易模式。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
