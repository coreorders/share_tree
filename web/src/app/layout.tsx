import type { Metadata } from 'next';
import './globals.css';

const basePath = process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.replace(/.*?\//, '')}`
  : '';

export const metadata: Metadata = {
  title: '지분나무 | 기업 지분 구조 시각화',
  description: '기업의 지분 구조를 마인드맵으로 시각화합니다. 주주, 보유 지분, 실시간 주가를 한눈에 확인하세요.',
  icons: {
    icon: `${basePath}/favicon.png`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="40dd6713-3832-4771-8a28-b6da265fa5e1"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
