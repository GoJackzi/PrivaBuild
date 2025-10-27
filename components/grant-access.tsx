"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import React, { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { toast } from "sonner"
import { getContractAddress } from "@/lib/contractUtils"
import PrivabuildArtifact from "@/artifacts/contracts/Privabuild.sol/Privabuild.json"
import { ethers } from "ethers"

export function GrantAccess() {
  const [submissionId, setSubmissionId] = useState("")
  const [reviewerAddress, setReviewerAddress] = useState("")
  const [action, setAction] = useState<"grant" | "revoke">("grant")

  const { address: userAddress, isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const handleSubmit = async (e: React.FormEvent<HTMLButtonElement>, actionType: "grant" | "revoke") => {
    e.preventDefault()

    if (!isConnected || !userAddress) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!submissionId || !reviewerAddress) {
      toast.error("Please fill in all fields")
      return
    }

    if (!ethers.isAddress(reviewerAddress)) {
      toast.error("Invalid reviewer address")
      return
    }

    // Validate submission ID format (must be bytes32 hex string)
    if (!submissionId.startsWith("0x") || submissionId.length !== 66) {
      toast.error("Invalid submission ID format (must be 0x... with 64 hex characters)")
      return
    }

    setAction(actionType)

    try {
      const contractAddress = getContractAddress()
      const functionName = actionType === "grant" ? "grantAccess" : "revokeAccess"

      toast.info(`${actionType === "grant" ? "Granting" : "Revoking"} access...`)

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: PrivabuildArtifact.abi,
        functionName,
        args: [submissionId as `0x${string}`, reviewerAddress as `0x${string}`],
      })
    } catch (error) {
      console.error("ACL operation failed:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Operation failed: ${message}`)
    }
  }

  React.useEffect(() => {
    if (isConfirmed) {
      toast.success(`🎉 Access ${action === "grant" ? "granted" : "revoked"} successfully!`)
      setSubmissionId("")
      setReviewerAddress("")
    }
  }, [isConfirmed, action])

  const isLoading = isPending || isConfirming

  return (
    <Card className="border-border bg-card p-8 h-full">
      <h2 className="mb-4 text-2xl font-bold text-[#ffd60a] text-center">Manage Access Control</h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Grant access to additional reviewers for your submissions
      </p>

        <form className="mb-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submission-id" className="text-foreground">
              Submission ID
            </Label>
            <Input
              id="submission-id"
              placeholder="0x... (copy from My Submissions)"
              className="border-border bg-secondary text-foreground font-mono text-xs"
              value={submissionId}
              onChange={(e) => setSubmissionId(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewer-address" className="text-foreground">
              Reviewer Wallet Address
            </Label>
            <Input
              id="reviewer-address"
              placeholder="0x..."
              className="border-border bg-secondary text-foreground"
              value={reviewerAddress}
              onChange={(e) => setReviewerAddress(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {!isConnected && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-center text-yellow-500">
              ⚠️ Please connect your wallet to manage access
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="button"
              onClick={(e) => handleSubmit(e, "grant")}
              className="flex-1 glow-yellow btn-3d"
              disabled={isLoading || !isConnected}
            >
              {isLoading && action === "grant" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isConfirming ? "Confirming..." : "Granting..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Grant Access
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={(e) => handleSubmit(e, "revoke")}
              variant="destructive"
              className="flex-1 btn-3d"
              disabled={isLoading || !isConnected}
            >
              {isLoading && action === "revoke" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isConfirming ? "Confirming..." : "Revoking..."}
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Revoke Access
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">💡 How it Works</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Use this if a reviewer requests access to your submission</li>
            <li>• Only you (the submission owner) can grant/revoke access</li>
            <li>• Authorized reviewers can then decrypt your submission</li>
            <li>• All changes are recorded on-chain</li>
          </ul>
        </div>
      </Card>
  )
}
