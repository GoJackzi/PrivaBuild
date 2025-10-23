import type React from "react"
import { Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

export const metadata = {
  title: "PrivaBuild - Private Onchain Collaboration Hub",
  description: "Built with Zama fhEVM v0.8.1 on Sepolia. Fully decentralized encrypted submissions.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
