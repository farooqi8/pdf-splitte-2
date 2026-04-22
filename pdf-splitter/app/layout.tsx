import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Splitter",
  description: "Split station PDFs into Saad, Gorman, and Extra outputs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">
        <div
          role="banner"
          className="shrink-0 border-b border-teal-800/30 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 px-4 py-2.5 shadow-sm sm:py-3"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 sm:gap-4">
            <Image
              src="/malik-rauf.jpg"
              alt=""
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-full border-2 border-white/25 object-cover shadow-md"
              priority
            />
            <p className="text-center text-xl font-bold tracking-wide text-white sm:text-2xl md:text-3xl">
              Malik Rauf
            </p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
