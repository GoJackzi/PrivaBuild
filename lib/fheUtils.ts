import { ethers, type Eip1193Provider } from "ethers";

let initSDK: typeof import("@zama-fhe/relayer-sdk/web").initSDK | null = null;
let createInstance: typeof import("@zama-fhe/relayer-sdk/web").createInstance | null = null;
let SepoliaConfig: typeof import("@zama-fhe/relayer-sdk/web").SepoliaConfig;
type FhevmInstance = import("@zama-fhe/relayer-sdk/web").FhevmInstance;

let sdkInitialized = false;

/**
 * FHE Utilities for Privabuild
 * Version: fhEVM v0.8.1
 * 
 * Migration Note: This module is designed for easy upgrade to fhEVM v0.9
 * When upgrading, only update imports and initialization - keep interface unchanged
 */

const FHE_VERSION = "0.8.1";

let fhevmInstance: FhevmInstance | null = null;

/**
 * Initialize fhEVM instance with Sepolia configuration
 * @param provider Ethereum provider (e.g., window.ethereum)
 * @returns Initialized FhevmInstance
 */
export async function initFhevm(provider: string | Eip1193Provider): Promise<FhevmInstance> {
  if (fhevmInstance) {
    console.log("✅ fhEVM already initialized");
    return fhevmInstance;
  }

  console.log(`🔐 Initializing fhEVM ${FHE_VERSION}...`);
  
  try {
    if (typeof window === "undefined") {
      throw new Error("fhEVM must be initialized in the browser environment");
    }

    // Polyfill global for browser compatibility
    if (typeof globalThis !== "undefined" && !(globalThis as { global?: unknown }).global) {
      (globalThis as { global?: unknown }).global = globalThis;
    }

    // Load SDK modules if not already loaded
    if (!initSDK || !createInstance) {
      const sdk = await import("@zama-fhe/relayer-sdk/web");
      initSDK = sdk.initSDK;
      createInstance = sdk.createInstance;
      SepoliaConfig = sdk.SepoliaConfig;
    }

    // Initialize TFHE WASM (must be called before createInstance)
    if (!sdkInitialized) {
      console.log("🔧 Loading TFHE WASM...");
      await initSDK!();
      sdkInitialized = true;
      console.log("✅ TFHE WASM loaded");
    }

    // Create instance with SepoliaConfig
    const config = {
      ...SepoliaConfig,
      network: provider,
    };

    fhevmInstance = await createInstance!(config);
    console.log("✅ fhEVM initialized successfully");
    
    return fhevmInstance;
  } catch (error) {
    console.error("❌ fhEVM initialization failed:", error);
    if (error instanceof Error && error.message.includes("relayer")) {
      throw new Error("Failed to connect to Zama Gateway (service may be temporarily down). Please try again later.");
    }
    throw new Error("Failed to initialize fhEVM");
  }
}

/**
 * Get the current fhEVM instance
 * @throws Error if not initialized
 */
export function getInstance(): FhevmInstance {
  if (!fhevmInstance) {
    throw new Error("fhEVM not initialized. Call initFhevm() first.");
  }
  return fhevmInstance;
}

/**
 * Encrypt a 256-bit value (euint256) for on-chain storage
 * @param value Value as BigInt or hex string
 * @param contractAddress Contract address that will receive the encrypted value
 * @param userAddress User's wallet address
 * @returns Encrypted handle and proof for contract submission
 */
export async function encryptValue(
  value: bigint | string,
  contractAddress: string,
  userAddress: string
): Promise<{ handle: string; proof: string }> {
  const instance = getInstance();
  
  try {
    // Create encrypted input buffer
    const buffer = instance.createEncryptedInput(contractAddress, userAddress);
    
    // Convert to BigInt if string
    const bigIntValue = typeof value === 'string' 
      ? BigInt(value.startsWith("0x") ? value : `0x${value}`)
      : value;
    
    // Add as euint256
    buffer.add256(bigIntValue);
    
    // Encrypt and generate proof
    const encrypted = await buffer.encrypt();

    return {
      handle: ethers.hexlify(encrypted.handles[0]),
      proof: ethers.hexlify(encrypted.inputProof),
    };
  } catch (error) {
    console.error("❌ Value encryption failed:", error);
    throw new Error("Failed to encrypt value");
  }
}

/**
 * Encrypt a hash value (euint256) for on-chain storage
 * @param hash Hash value as hex string (e.g., from ethers.keccak256)
 * @param contractAddress Contract address that will receive the encrypted value
 * @param userAddress User's wallet address
 * @returns Encrypted handle and proof for contract submission
 */
export async function encryptHash(
  hash: string,
  contractAddress: string,
  userAddress: string
): Promise<{ handle: string; proof: string }> {
  return encryptValue(hash, contractAddress, userAddress);
}

/**
 * Check if fhEVM is initialized
 */
export function isInitialized(): boolean {
  return fhevmInstance !== null;
}

/**
 * Reset fhEVM instance (useful for testing or network changes)
 */
export function resetInstance(): void {
  fhevmInstance = null;
  sdkInitialized = false;
  console.log("🔄 fhEVM instance reset");
}

/**
 * Get current fhEVM version
 */
export function getVersion(): string {
  return FHE_VERSION;
}

/**
 * Decrypt an encrypted value using user decryption (client-side)
 * @param encryptedHandle The encrypted handle (euint256) from the contract
 * @param contractAddress Contract address where the value is stored
 * @param userAddress User's wallet address
 * @returns Decrypted value as BigInt
 */
export async function userDecrypt(
  encryptedHandle: string,
  contractAddress: string,
  userAddress: string
): Promise<bigint> {
  const instance = getInstance();
  
  try {
    console.log("🔓 Decrypting value with user decryption...");
    
    // Generate keypair for user decryption
    const keypair = instance.generateKeypair();
    console.log("🔑 Generated keypair for user decryption");
    
    // Prepare handle-contract pairs
    const handleContractPairs = [{
      handle: encryptedHandle,
      contractAddress: contractAddress,
    }];
    
    // Set up time parameters
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // 10 days validity
    const contractAddresses = [contractAddress];
    
    // Create EIP-712 signature
    console.log("📝 Creating EIP-712 signature...");
    const eip712 = instance.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );
    
    // Get signer from ethers
    const provider = new ethers.BrowserProvider((window as typeof window & { ethereum?: ethers.Eip1193Provider }).ethereum!);
    const signer = await provider.getSigner();
    
    // Sign the EIP-712 message
    console.log("✍️ Signing EIP-712 message...");
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    
    // Perform user decryption with 30-second timeout
    console.log("🔓 Requesting user decryption from KMS...");
    const decryptionPromise = instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      userAddress,
      startTimeStamp,
      durationDays
    );
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("User decryption timeout - KMS may be slow")), 30000);
    });
    
    const result = await Promise.race([decryptionPromise, timeoutPromise]);
    
    const decryptedValue = result[encryptedHandle];
    console.log("✅ Value decrypted successfully");
    return BigInt(decryptedValue);
  } catch (error) {
    console.error("❌ User decryption failed:", error);
    if (error instanceof Error && error.message.includes("timeout")) {
      throw new Error("KMS decryption timeout - please try again");
    }
    throw new Error("Failed to decrypt value - you may not have permission");
  }
}


