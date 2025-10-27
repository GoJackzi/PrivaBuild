import { ethers } from "ethers";
import type { Abi, PublicClient } from "viem";
import contractConfig from "./contract-config.json";
import PrivabuildABI from "./PrivabuildABI.json";

/**
 * Contract utilities for interacting with Privabuild smart contract
 */

// Privabuild contract ABI (imported from artifacts to stay in sync with Solidity)
export const PRIVABUILD_ABI = PrivabuildABI.abi as Abi;
const PRIVABUILD_ETHERS_ABI = PrivabuildABI.abi as ethers.InterfaceAbi;

type SubmissionCreatedEventArgs = {
  id: `0x${string}`;
  builder: string;
  name: string;
  ipfsCID: string;
  timestamp: bigint;
};

/**
 * Get contract address from config
 */
export function getContractAddress(): string {
  return contractConfig.contractAddress;
}

/**
 * Get contract instance for read operations
 */
export function getContractRead(provider: ethers.Provider): ethers.Contract {
  return new ethers.Contract(getContractAddress(), PRIVABUILD_ETHERS_ABI, provider);
}

/**
 * Get contract instance for write operations
 */
export function getContractWrite(signer: ethers.Signer): ethers.Contract {
  return new ethers.Contract(getContractAddress(), PRIVABUILD_ETHERS_ABI, signer);
}

export function getViemContract(publicClient: PublicClient) {
  const address = getContractAddress() as `0x${string}`;

  return {
    async getSubmissionMeta(id: `0x${string}`) {
      const result = await publicClient.readContract({
        address,
        abi: PRIVABUILD_ABI,
        functionName: "getSubmissionMeta",
        args: [id],
      });

      const [name, cid, time, builder] = result as [string, string, bigint, string];

      return {
        name,
        cid,
        time,
        builder,
      };
    },

    async getSubmissionEvents(fromBlock: bigint, toBlock: bigint) {
      const CHUNK_SIZE = 10n; // Alchemy free tier block range limit
      const DELAY_MS = 200; // Delay between requests to avoid rate limits
      const allLogs: any[] = [];

      // Fetch events in chunks to respect Alchemy's free tier limits
      let currentFrom = fromBlock;
      
      while (currentFrom <= toBlock) {
        const currentTo = currentFrom + CHUNK_SIZE - 1n > toBlock 
          ? toBlock 
          : currentFrom + CHUNK_SIZE - 1n;

        try {
          const logs = await publicClient.getContractEvents({
            address,
            abi: PRIVABUILD_ABI,
            eventName: "SubmissionCreated",
            fromBlock: currentFrom,
            toBlock: currentTo,
          });

          allLogs.push(...logs);
          
          // Add delay between requests to avoid rate limiting
          if (currentTo < toBlock) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
        } catch (error) {
          console.warn(`Failed to fetch events from block ${currentFrom} to ${currentTo}:`, error);
          // Continue with next chunk even if one fails
        }

        currentFrom = currentTo + 1n;
      }

      return allLogs.map((log) => {
        const args = log.args as SubmissionCreatedEventArgs;

        return {
          id: args.id,
          builder: args.builder,
          name: args.name,
          ipfsCID: args.ipfsCID,
          timestamp: Number(args.timestamp),
        };
      });
    },
  };
}

/**
 * Submit a new project to Privabuild
 */
export async function submitProject(
  signer: ethers.Signer,
  builderName: string,
  ipfsCID: string,
  encryptedHash: string,
  hashProof: string,
  reviewerAddress?: string
) {
  const contract = getContractWrite(signer);
  
  const tx = await contract.submit(
    builderName,
    ipfsCID,
    encryptedHash,
    hashProof,
    reviewerAddress || ethers.ZeroAddress
  );

  console.log("📝 Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed");

  // Extract submission ID from event
  const event = receipt.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null): parsed is ethers.LogDescription => parsed?.name === "SubmissionCreated");

  if (event) {
    return event.args.id;
  }

  throw new Error("Submission ID not found in transaction");
}

/**
 * Grant access to a reviewer
 */
export async function grantAccessToReviewer(
  signer: ethers.Signer,
  submissionId: string,
  reviewerAddress: string
) {
  const contract = getContractWrite(signer);
  
  const tx = await contract.grantAccess(submissionId, reviewerAddress);
  await tx.wait();
  
  return tx.hash;
}

/**
 * Get all submissions
 */
export async function getAllSubmissions(provider: ethers.Provider) {
  const contract = getContractRead(provider);
  
  const ids = await contract.getAllSubmissionIds();
  
  const submissions = await Promise.all(
    ids.map(async (id: string) => {
      const [name, cid, time, builder] = await contract.getSubmissionMeta(id);
      return {
        id,
        builderName: name,
        ipfsCID: cid,
        timestamp: Number(time),
        builder,
      };
    })
  );

  return submissions;
}

/**
 * Get submission by ID
 */
export async function getSubmission(provider: ethers.Provider, id: string) {
  const contract = getContractRead(provider);
  
  const [name, cid, time, builder] = await contract.getSubmissionMeta(id);
  
  return {
    id,
    builderName: name,
    ipfsCID: cid,
    timestamp: Number(time),
    builder,
  };
}

/**
 * Listen for new submissions
 */
export function watchSubmissions(
  provider: ethers.Provider,
  callback: (event: {
    id: string;
    builder: string;
    builderName: string;
    ipfsCID: string;
    timestamp: number;
    transactionHash: string;
  }) => void
) {
  const contract = getContractRead(provider);
  
  contract.on("SubmissionCreated", (id, builder, name, ipfsCID, timestamp, event) => {
    callback({
      id,
      builder,
      builderName: name,
      ipfsCID,
      timestamp: Number(timestamp),
      transactionHash: event.log.transactionHash,
    });
  });

  return () => {
    contract.removeAllListeners("SubmissionCreated");
  };
}

/**
 * Get Privabuild contract instance for wagmi publicClient
 */
export function getPrivabuildContract(publicClient: PublicClient) {
  return getViemContract(publicClient);
}

