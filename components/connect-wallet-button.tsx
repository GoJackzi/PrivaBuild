"use client"

import { useEffect, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"

interface ConnectWalletButtonProps {
  className?: string
}

export function ConnectWalletButton({ className }: ConnectWalletButtonProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return (
    <div className={className}>
      <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
    </div>
  )
}
