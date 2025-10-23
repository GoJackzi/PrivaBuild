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

    setAction(actionType)

    try {
      const contractAddress = getContractAddress()
      const functionName = actionType === "grant" ? "grantAccess" : "revokeAccess"

      toast.info(`${actionType === "grant" ? "Granting" : "Revoking"} access...`)

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: PrivabuildArtifact.abi,
        functionName,
        args: [BigInt(submissionId), reviewerAddress],
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
    <section className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-2xl border-border bg-card p-8">
        <h2 className="mb-6 text-3xl font-bold text-[#ffd60a] text-center">Manage Access Control</h2>

        <form className="mb-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submission-id" className="text-foreground">
              Submission ID
            </Label>
            <Input
              id="submission-id"
              placeholder="e.g. 1"
              className="border-border bg-secondary text-foreground"
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
            <li>• Only the submission owner can grant/revoke access</li>
            <li>• Authorized reviewers can decrypt submission data client-side</li>
            <li>• All changes are recorded on-chain via ACL events</li>
            <li>• Default reviewer is set during submission (or burn address if empty)</li>
          </ul>
        </div>
      </Card>
    </section>
  )
}
