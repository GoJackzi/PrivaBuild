"use client"

import { Card } from "@/components/ui/card"
import { Lock, Loader2, Unlock, ExternalLink, X } from "lucide-react"
import { useEffect, useState } from "react"
import { usePublicClient, useAccount } from "wagmi"
import { formatDistanceToNow } from "date-fns"
import { getViemContract, getContractAddress, PRIVABUILD_ABI } from "@/lib/contractUtils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import PrivabuildArtifact from "@/artifacts/contracts/Privabuild.sol/Privabuild.json"
import { ethers } from "ethers"

interface Submission {
  id: string
  builder: string
  builderName: string
  timestampLabel: string
  timeValue: number
  ipfsCID: string
}

interface DecryptedData {
  website: string
  github: string
  video: string
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
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedData, setDecryptedData] = useState<DecryptedData | null>(null)
  
  const publicClient = usePublicClient()
  const { address: userAddress, isConnected } = useAccount()

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!publicClient) return

      try {
        setIsLoading(true)
        const contract = getViemContract(publicClient)

        const latestBlock = await publicClient.getBlockNumber()
        // Limit to last 100 blocks (~20 minutes on Sepolia) to respect Alchemy rate limits
        // Will make 10 requests with 200ms delays = ~2 second load time
        const fromBlock = latestBlock > 100n ? latestBlock - 100n : 0n
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

  const handleDecrypt = async (submission: Submission) => {
    if (!isConnected || !userAddress) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!publicClient) {
      toast.error("Public client not available")
      return
    }

    setSelectedSubmission(submission)
    setIsDecrypting(true)
    setDecryptedData(null)
    toast.info("🔓 Decrypting submission...")

    try {
      // Dynamically import browser-only modules
      const { initFhevm, userDecrypt } = await import("@/lib/fheUtils")
      const { downloadAndDecrypt } = await import("@/lib/ipfsStorage")
      const { encodeBase64 } = await import("tweetnacl-util")

      const contractAddress = getContractAddress()

      // Get encrypted key and nonce handles from contract
      console.log("🔐 Fetching encrypted key and nonce...")
      const encryptedKeyHandle = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: PrivabuildArtifact.abi,
        functionName: "getEncryptedKey",
        args: [submission.id as `0x${string}`],
      })

      const encryptedNonceHandle = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: PrivabuildArtifact.abi,
        functionName: "getEncryptedNonce",
        args: [submission.id as `0x${string}`],
      })

      console.log("✅ Encrypted handles retrieved")

      // Initialize fhEVM
      const ethereumProvider = (window as typeof window & { ethereum?: ethers.Eip1193Provider }).ethereum
      if (!ethereumProvider) {
        throw new Error("Ethereum provider not found")
      }

      await initFhevm(ethereumProvider)

      // Decrypt the key and nonce using user decryption
      console.log("🔓 Decrypting encryption key...")
      const decryptedKeyBigInt = await userDecrypt(
        encryptedKeyHandle as string,
        contractAddress,
        userAddress
      )

      console.log("🔓 Decrypting nonce...")
      const decryptedNonceBigInt = await userDecrypt(
        encryptedNonceHandle as string,
        contractAddress,
        userAddress
      )

      // Convert BigInt back to base64 strings
      const keyHex = decryptedKeyBigInt.toString(16).padStart(64, '0')
      const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      const encryptionKey = encodeBase64(keyBytes)

      const nonceHex = decryptedNonceBigInt.toString(16).padStart(48, '0')
      const nonceBytes = new Uint8Array(nonceHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      const nonce = encodeBase64(nonceBytes)

      console.log("🔑 Decrypted key and nonce successfully")

      // Download and decrypt data from IPFS
      console.log("📥 Downloading from IPFS...")
      const data = await downloadAndDecrypt(
        submission.ipfsCID,
        encryptionKey,
        nonce
      )

      setDecryptedData(data)
      toast.success("✅ Submission decrypted successfully!")
    } catch (error) {
      console.error("Decryption failed:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      
      if (message.includes("permission") || message.includes("ACL")) {
        toast.error("❌ Access denied: You don't have permission to decrypt this submission")
      } else {
        toast.error(`❌ Decryption failed: ${message}`)
      }
      
      setDecryptedData(null)
      setSelectedSubmission(null)
    } finally {
      setIsDecrypting(false)
    }
  }

  const closeModal = () => {
    setSelectedSubmission(null)
    setDecryptedData(null)
    setIsDecrypting(false)
  }

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
                <th className="p-4 text-center text-sm font-semibold text-foreground">Actions</th>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecrypt(submission)}
                        disabled={!isConnected}
                        className="border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a] hover:text-black"
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Decrypt
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Decrypt Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Card className="relative mx-4 w-full max-w-2xl border-border bg-card p-8">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-6 text-2xl font-bold text-[#ffd60a] flex items-center gap-2">
              <Unlock className="h-6 w-6" />
              Decrypt Submission
            </h3>

            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Builder:</span>
                <span className="text-foreground font-semibold">{selectedSubmission.builderName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Submitted:</span>
                <span className="text-foreground">{selectedSubmission.timestampLabel}</span>
              </div>
            </div>

            {isDecrypting && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#ffd60a] mb-4" />
                <p className="text-muted-foreground">Decrypting submission...</p>
              </div>
            )}

            {!isDecrypting && decryptedData && (
              <div className="rounded-lg border border-[#ffd60a]/30 bg-[#ffd60a]/5 p-6 space-y-4">
                <div className="flex items-center gap-2 text-[#ffd60a] font-semibold mb-4">
                  <Lock className="h-5 w-5" />
                  <span>Decrypted Data</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Website</p>
                    <a
                      href={decryptedData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#ffd60a] hover:underline"
                    >
                      {decryptedData.website}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">GitHub</p>
                    <a
                      href={decryptedData.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#ffd60a] hover:underline"
                    >
                      {decryptedData.github}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {decryptedData.video && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Video</p>
                      <a
                        href={decryptedData.video}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[#ffd60a] hover:underline"
                      >
                        {decryptedData.video}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isDecrypting && !decryptedData && (
              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground text-center">
                  Click outside or press the X button to close
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}
