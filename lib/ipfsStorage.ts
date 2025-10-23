import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import { ethers } from "ethers";

/**
 * IPFS Storage Utilities for Privabuild
 * Handles client-side encryption/decryption and IPFS uploads via Pinata
 */

export interface SubmissionData {
  website: string;
  github: string;
  video: string;
}

export interface EncryptionResult {
  ipfsCID: string;
  dataHash: string;
  encryptionKey: string;
  nonce: string;
}

export interface EncryptionMetadata {
  encryptionKey: string;
  nonce: string;
}

/**
 * Encrypt submission data and upload to IPFS
 * @param data Submission data (website, github, video URLs)
 * @param walletAddress User's wallet address (for logging/tracking)
 * @returns Encryption result with IPFS CID and hash
 */
export async function encryptAndUpload(
  data: SubmissionData,
  walletAddress: string
): Promise<EncryptionResult> {
  console.log("🔐 Encrypting submission data...");

  // 1. Generate encryption key and nonce
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  // 2. Encrypt the data
  const message = JSON.stringify(data);
  const messageUint8 = new TextEncoder().encode(message);
  const encrypted = nacl.secretbox(messageUint8, nonce, key);

  console.log("✅ Data encrypted");

  // 3. Compute hash of encrypted data for on-chain verification
  const dataHash = ethers.keccak256(encrypted);
  console.log("🔑 Data hash:", dataHash);

  // 4. Upload to IPFS via Pinata API route
  console.log("📤 Uploading to IPFS...");
  const formData = new FormData();
  const encryptedBuffer = encrypted.buffer.slice(
    encrypted.byteOffset,
    encrypted.byteOffset + encrypted.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
  formData.append("file", blob, "submission.enc");
  formData.append("metadata", JSON.stringify({
    builder: walletAddress,
    timestamp: new Date().toISOString(),
  }));

  try {
    const response = await fetch("/api/pinata/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "IPFS upload failed");
    }

    const { cid } = await response.json();
    console.log("✅ Uploaded to IPFS:", cid);

    return {
      ipfsCID: cid,
      dataHash,
      encryptionKey: encodeBase64(key),
      nonce: encodeBase64(nonce),
    };
  } catch (error) {
    console.error("❌ IPFS upload error:", error);
    throw new Error("Failed to upload to IPFS");
  }
}

/**
 * Download from IPFS and decrypt submission data
 * @param ipfsCID IPFS content identifier
 * @param encryptionKey Base64-encoded encryption key
 * @param nonce Base64-encoded nonce
 * @returns Decrypted submission data
 */
export async function downloadAndDecrypt(
  ipfsCID: string,
  encryptionKey: string,
  nonce: string
): Promise<SubmissionData> {
  console.log("📥 Downloading from IPFS:", ipfsCID);

  try {
    // 1. Fetch from IPFS via Pinata gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "gateway.pinata.cloud";
    const response = await fetch(`https://${gatewayUrl}/ipfs/${ipfsCID}`);

    if (!response.ok) {
      throw new Error(`IPFS download failed: ${response.statusText}`);
    }

    const encryptedData = new Uint8Array(await response.arrayBuffer());
    console.log("✅ Downloaded from IPFS");

    // 2. Decrypt data
    console.log("🔓 Decrypting data...");
    const key = decodeBase64(encryptionKey);
    const nonceBytes = decodeBase64(nonce);

    const decrypted = nacl.secretbox.open(encryptedData, nonceBytes, key);

    if (!decrypted) {
      throw new Error("Decryption failed - invalid key or corrupted data");
    }

    // 3. Parse JSON
    const message = new TextDecoder().decode(decrypted);
    const data = JSON.parse(message);
    
    console.log("✅ Data decrypted successfully");
    return data;
  } catch (error) {
    console.error("❌ Download/decrypt error:", error);
    throw new Error("Failed to download or decrypt data");
  }
}

/**
 * Verify data integrity by comparing hash
 * @param data Decrypted submission data
 * @param expectedHash Expected hash (from blockchain)
 * @param encryptionKey Encryption key used
 * @param nonce Nonce used
 * @returns True if hash matches
 */
export function verifyDataHash(
  data: SubmissionData,
  expectedHash: string,
  encryptionKey: string,
  nonce: string
): boolean {
  try {
    // Re-encrypt data
    const message = JSON.stringify(data);
    const messageUint8 = new TextEncoder().encode(message);
    const key = decodeBase64(encryptionKey);
    const nonceBytes = decodeBase64(nonce);
    const encrypted = nacl.secretbox(messageUint8, nonceBytes, key);

    // Compute hash
    const computedHash = ethers.keccak256(encrypted);

    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    console.error("❌ Hash verification error:", error);
    return false;
  }
}

/**
 * Store encryption metadata in browser's localStorage
 * @param submissionId Submission ID from blockchain
 * @param metadata Encryption metadata (key and nonce)
 */
export function storeEncryptionMetadata(
  submissionId: string,
  metadata: EncryptionMetadata
): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `privabuild_enc_${submissionId}`;
    localStorage.setItem(key, JSON.stringify(metadata));
    console.log("💾 Encryption metadata stored locally");
  } catch (error) {
    console.error("❌ Failed to store metadata:", error);
  }
}

/**
 * Retrieve encryption metadata from localStorage
 * @param submissionId Submission ID from blockchain
 * @returns Encryption metadata or null if not found
 */
export function getEncryptionMetadata(
  submissionId: string
): EncryptionMetadata | null {
  if (typeof window === "undefined") return null;
  
  try {
    const key = `privabuild_enc_${submissionId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.error("❌ Failed to retrieve metadata:", error);
    return null;
  }
}



