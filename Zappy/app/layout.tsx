import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zappy — Play. Learn. Level Up.",
  description: "A super-learning world where school subjects become games, quests, and real-world skills.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Zappy — Play. Learn. Level Up.",
    description: "School subjects become games, quests, and real-world skills.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Zappy learning adventure" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zappy — Play. Learn. Level Up.",
    description: "School subjects become games, quests, and real-world skills.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
