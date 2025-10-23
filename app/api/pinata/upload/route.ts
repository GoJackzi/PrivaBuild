import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

/**
 * Pinata IPFS Upload API Route
 * Server-side only - keeps JWT secret
 */

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = (await request.formData()) as unknown as FormData;
    const file = formData.get("file") as File;
    const metadataStr = formData.get("metadata") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const TEN_MB = 10 * 1024 * 1024;
    if (file.size > TEN_MB) {
      return NextResponse.json(
        { error: "File too large", details: "Maximum allowed size is 10MB" },
        { status: 413 }
      );
    }

    console.log("📤 Uploading file to Pinata...");
    console.log("   File size:", file.size, "bytes");

    // Parse metadata if provided
    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        console.warn("Failed to parse metadata, using empty object");
      }
    }

    // Upload to Pinata with metadata
    const upload = await pinata.upload.file(file).addMetadata({
      name: file.name,
      keyValues: metadata as Record<string, string>,
    });

    console.log("✅ File uploaded to IPFS");
    console.log("   CID:", upload.IpfsHash);

    return NextResponse.json({
      cid: upload.IpfsHash,
      size: upload.PinSize,
      timestamp: upload.Timestamp,
    });
  } catch (error) {
    console.error("❌ Pinata upload error:", error);
    
    return NextResponse.json(
      { 
        error: "Upload failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

