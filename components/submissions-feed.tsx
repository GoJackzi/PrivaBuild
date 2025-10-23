"use client"

import { Card } from "@/components/ui/card"
import { Lock, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { usePublicClient } from "wagmi"
import { formatDistanceToNow } from "date-fns"
import { getViemContract, getContractAddress, PRIVABUILD_ABI } from "@/lib/contractUtils"

interface Submission {
  id: string
  builder: string
  builderName: string
  timestampLabel: string
  timeValue: number
  ipfsCID: string
}

type SubmissionCreatedLog = {
  args: {
    id: `0x${string}`
    builder: string
    name: string
    ipfsCID: string
    timestamp: bigint
  }
}

export function SubmissionsFeed() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const publicClient = usePublicClient()

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!publicClient) return

      try {
        setIsLoading(true)
        const contract = getViemContract(publicClient)

        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n
        const events = await contract.getSubmissionEvents(fromBlock, latestBlock)

        const fetchedSubmissions: Submission[] = await Promise.all(
          events.map(async (event) => {
            const meta = await contract.getSubmissionMeta(event.id)
            const timeValue = Number(meta.time)

            return {
              id: event.id,
              builder: event.builder,
              builderName: meta.name || event.name,
              timestampLabel: formatDistanceToNow(new Date(timeValue * 1000), { addSuffix: true }),
              timeValue,
              ipfsCID: meta.cid || event.ipfsCID,
            }
          })
        )

        setSubmissions(fetchedSubmissions.sort((a, b) => b.timeValue - a.timeValue))
      } catch (error) {
        console.error("Failed to fetch submissions:", error)
        setSubmissions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubmissions()

    // Set up event listener for new submissions
    if (publicClient) {
      const contract = getViemContract(publicClient)

      const unsubscribe = publicClient.watchContractEvent({
        address: getContractAddress() as `0x${string}`,
        abi: PRIVABUILD_ABI,
        eventName: "SubmissionCreated",
        onLogs: async (logs) => {
          const typedLogs = logs as unknown as SubmissionCreatedLog[]
          const updates = await Promise.all(
            typedLogs.map(async (log) => {
              const id = log.args.id
              const builder = log.args.builder
              const name = log.args.name
              const ipfsCID = log.args.ipfsCID

              const meta = await contract.getSubmissionMeta(id)

              const timeValue = Number(meta.time)

              return {
                id,
                builder,
                builderName: meta.name || name,
                timestampLabel: formatDistanceToNow(new Date(timeValue * 1000), { addSuffix: true }),
                timeValue,
                ipfsCID: meta.cid || ipfsCID,
              }
            })
          )

          setSubmissions((prev) => {
            const existing = new Map(prev.map((item) => [item.id, item]))
            updates.forEach((update) => existing.set(update.id, update))
            return Array.from(existing.values()).sort((a, b) => b.timeValue - a.timeValue)
          })
        },
      })

      return () => {
        unsubscribe?.()
      }
    }
  }, [publicClient])

  if (isLoading) {
    return (
      <section id="submissions" className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-3xl font-bold text-[#ffd60a] text-center">
          Recent Submissions <span className="text-[#ffd60a]/70">(Encrypted)</span>
        </h2>
        <Card className="border-border bg-card p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading submissions from blockchain...</p>
          </div>
        </Card>
      </section>
    )
  }

  return (
    <section id="submissions" className="container mx-auto px-4 py-16">
      <h2 className="mb-8 text-3xl font-bold text-[#ffd60a] text-center">
        Recent Submissions <span className="text-[#ffd60a]/70">(Encrypted)</span>
      </h2>

      <Card className="border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-sm font-semibold text-foreground">Builder Name</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground">Timestamp</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground">IPFS CID</th>
                <th className="p-4 text-center text-sm font-semibold text-foreground">Encryption</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No submissions yet. Be the first to submit! 🚀
                  </td>
                </tr>
              ) : (
                submissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-border transition-colors hover:bg-secondary/50">
                    <td className="p-4 text-foreground">{submission.builderName}</td>
                    <td className="p-4 text-muted-foreground">{submission.timestampLabel}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      <a
                        href={`https://${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${submission.ipfsCID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {submission.ipfsCID.substring(0, 8)}...{submission.ipfsCID.substring(submission.ipfsCID.length - 6)}
                      </a>
                    </td>
                    <td className="p-4 text-center">
                      <Lock className="mx-auto h-5 w-5 text-primary" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
