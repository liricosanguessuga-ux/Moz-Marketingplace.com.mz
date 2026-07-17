export const metadata = {
  title: "Moz Marketing Place",
  description: "Compra e venda de produtos e serviços em Moçambique.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-MZ">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
