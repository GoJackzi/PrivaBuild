"use client"

import { Button } from "@/components/ui/button"
import { ConnectWalletButton } from "./connect-wallet-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Info, Loader2 } from "lucide-react"
import React, { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { toast } from "sonner"
import { getContractAddress } from "@/lib/contractUtils"
import { ethers } from "ethers"
import PrivabuildArtifact from "@/artifacts/contracts/Privabuild.sol/Privabuild.json"

export function SubmissionForm() {
  const [builderName, setBuilderName] = useState("")
  const [website, setWebsite] = useState("")
  const [github, setGithub] = useState("")
  const [video, setVideo] = useState("")
  const [reviewer, setReviewer] = useState("")
  const [isEncrypting, setIsEncrypting] = useState(false)

  const { address: userAddress, isConnected } = useAccount()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !userAddress) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!builderName || !website || !github) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsEncrypting(true)
    toast.info("🔐 Encrypting your submission...")

    try {
      // Dynamically import browser-only modules
      const { encryptAndUpload } = await import("@/lib/ipfsStorage")
      const { initFhevm, encryptHash } = await import("@/lib/fheUtils")
      
      // 1. Encrypt data and upload to IPFS
      const { ipfsCID, dataHash, encryptionKey } = await encryptAndUpload(
        { website, github, video },
        userAddress
      )
      
      console.log("✅ Encrypted & uploaded to IPFS:", ipfsCID)
      console.log("🔑 Store this encryption key safely:", encryptionKey)
      toast.success("Data encrypted and uploaded to IPFS!")

      // 2. Initialize fhEVM and encrypt the data hash
      const ethereumProvider = (window as typeof window & { ethereum?: ethers.Eip1193Provider }).ethereum

      if (!ethereumProvider) {
        throw new Error("Ethereum provider not found. Please install MetaMask or compatible wallet.")
      }

      await initFhevm(ethereumProvider)
      
      const contractAddress = getContractAddress()
      const { handle: encryptedHashHandle, proof: hashProof } = await encryptHash(
        dataHash,
        contractAddress,
        userAddress
      )
      
      toast.info("📝 Submitting to blockchain...")

      // 3. Prepare reviewer address
      const reviewerAddress = reviewer || ethers.ZeroAddress

      // 4. Call the smart contract
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: PrivabuildArtifact.abi,
        functionName: "submit",
        args: [
          builderName,
          ipfsCID,
          encryptedHashHandle,
          hashProof,
          reviewerAddress,
        ],
      })
    } catch (error) {
      console.error("Submission failed:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Submission failed: ${message}`)
      setIsEncrypting(false)
    }
  }

  // Handle transaction confirmation
  React.useEffect(() => {
    if (isConfirmed) {
      toast.success("🎉 Encrypted submission sent to Ethereum Sepolia!")
      setBuilderName("")
      setWebsite("")
      setGithub("")
      setVideo("")
      setReviewer("")
      setIsEncrypting(false)
    }
    if (isConfirming) {
      toast.info("⏳ Confirming transaction...")
    }
    if (!isWritePending && !isConfirming && isEncrypting) {
      setIsEncrypting(false)
    }
  }, [isConfirmed, isConfirming, isWritePending, isEncrypting])

  const isLoading = isEncrypting || isWritePending || isConfirming

  return (
    <section className="container mx-auto px-4 py-0">
      <div className="mb-6 flex justify-center">
        <ConnectWalletButton />
      </div>
      <h2 className="mb-6 text-4xl font-bold text-[#ffd60a] text-center">Submit Your Project</h2>
      <Card className="mx-auto max-w-2xl border-border bg-card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="builder-name" className="text-foreground">
              Builder Name <span className="text-muted-foreground">(public)</span>
            </Label>
            <Input 
              id="builder-name" 
              placeholder="Your name" 
              className="border-border bg-secondary text-foreground"
              value={builderName}
              onChange={(e) => setBuilderName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="text-foreground">
              App Website <span className="text-primary">🔒 encrypted</span>
            </Label>
            <Input
              id="website"
              placeholder="https://yourapp.com"
              className="border-border bg-secondary text-foreground"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github" className="text-foreground">
              GitHub Repo <span className="text-primary">🔒 encrypted</span>
            </Label>
            <Input
              id="github"
              placeholder="https://github.com/username/repo"
              className="border-border bg-secondary text-foreground"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video" className="text-foreground">
              Video Link <span className="text-muted-foreground">(optional)</span> <span className="text-primary">🔒 encrypted</span>
            </Label>
            <Input
              id="video"
              placeholder="https://youtube.com/watch?v=..."
              className="border-border bg-secondary text-foreground"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewer" className="text-foreground">
              Optional Reviewer Wallet Address
            </Label>
            <Input 
              id="reviewer" 
              placeholder="0x..." 
              className="border-border bg-secondary text-foreground"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                If you leave Reviewer Address empty, a default Team address will be used as reviewer. (for Demo:
                0x000...dEaD)
              </p>
            </div>
          </div>

          {!isConnected && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-center text-yellow-500">
              ⚠️ Please connect your wallet to submit
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full glow-yellow btn-3d"
            size="lg"
            disabled={isLoading || !isConnected}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEncrypting ? "Encrypting..." : isConfirming ? "Confirming..." : "Submitting..."}
              </>
            ) : (
              "Submit Project"
            )}
          </Button>
        </form>
      </Card>
    </section>
  )
}
