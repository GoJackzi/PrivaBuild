"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { getViemContract } from "@/lib/contractUtils"

interface MySubmission {
  id: string
  builderName: string
  ipfsCID: string
  timestamp: number
  timestampLabel: string
}

export function MySubmissions() {
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { address: userAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()

  useEffect(() => {
    const fetchMySubmissions = async () => {
      if (!publicClient || !userAddress) {
        setMySubmissions([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const contract = getViemContract(publicClient)

        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 100n ? latestBlock - 100n : 0n
        const events = await contract.getSubmissionEvents(fromBlock, latestBlock)

        // Filter only submissions by the connected user
        const myEvents = events.filter(
          (event) => event.builder.toLowerCase() === userAddress.toLowerCase()
        )

        const submissions: MySubmission[] = myEvents.map((event) => ({
          id: event.id,
          builderName: event.name,
          ipfsCID: event.ipfsCID,
          timestamp: event.timestamp,
          timestampLabel: formatDistanceToNow(new Date(event.timestamp * 1000), {
            addSuffix: true,
          }),
        }))

        setMySubmissions(submissions.sort((a, b) => b.timestamp - a.timestamp))
      } catch (error) {
        console.error("Failed to fetch my submissions:", error)
        setMySubmissions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMySubmissions()
  }, [publicClient, userAddress])

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
    toast.success("Submission ID copied to clipboard!")
  }

  if (!isConnected) {
    return (
      <Card className="border-border bg-card p-8 h-full">
        <h3 className="mb-4 text-2xl font-bold text-[#ffd60a] text-center">
          My Submissions
        </h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-center text-muted-foreground">
            Connect your wallet to see your submissions
          </p>
        </div>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card p-8 h-full">
        <h3 className="mb-4 text-2xl font-bold text-[#ffd60a] text-center">
          My Submissions
        </h3>
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#ffd60a] mb-4" />
          <p className="text-muted-foreground">Loading your submissions...</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card p-8 h-full">
      <h3 className="mb-4 text-2xl font-bold text-[#ffd60a] text-center">
        My Submissions
      </h3>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Your submission IDs for access management
      </p>

      {mySubmissions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-2">No submissions yet</p>
          <p className="text-sm text-muted-foreground">
            Submit a project to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {mySubmissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-foreground">
                    {submission.builderName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {submission.timestampLabel}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Submission ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-black/50 px-2 py-1 text-xs text-[#ffd60a] font-mono break-all">
                    {submission.id}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(submission.id)}
                    className="border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a] hover:text-black shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                IPFS: {submission.ipfsCID.substring(0, 12)}...
              </p>
            </div>
          ))}
        </div>
      )}

          <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground text-center">
              💡 Copy the Submission ID to use in &ldquo;Manage Access Control&rdquo;
            </p>
          </div>
    </Card>
  )
}


