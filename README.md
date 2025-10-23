# Privabuild

Submit your work privately. Verify it publicly.

A dApp where builders can submit their projects with full encryption using Zama's fhEVM on Ethereum Sepolia. Your submission data stays encrypted on-chain and only you (and reviewers you authorize) can access it.

## What's this?

Think of it like a secure dropbox for builders—except everything is encrypted before it even hits the blockchain. Your website links, GitHub repos, and demo videos are encrypted locally, stored on IPFS, and verified on-chain using fhEVM. No one can see your submission unless you explicitly grant them access.

## How it works

1. **You encrypt locally** - Your URLs get encrypted in your browser using TweetNaCl
2. **Upload to IPFS** - Encrypted data goes to IPFS via Pinata
3. **Hash gets encrypted with fhEVM** - A verification hash is encrypted using Zama's fhEVM
4. **Submit to blockchain** - Only the encrypted hash and public metadata (your name, timestamp) go on-chain
5. **Grant access when ready** - Use fhEVM's built-in ACL to let reviewers decrypt your submission

## Tech stack

- Next.js + React + Tailwind CSS
- Zama fhEVM (for on-chain encrypted data)
- IPFS via Pinata (for encrypted file storage)
- Hardhat (smart contract development)
- RainbowKit + Wagmi (wallet connection)
- Sepolia testnet

## Getting started

**1. Clone and install**

```bash
git clone https://github.com/YOUR_USERNAME/Privabuild.git
cd Privabuild
npm install
```

**2. Set up your environment**

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

You'll need:
- An Alchemy API key (get one at [alchemy.com](https://alchemy.com))
- A wallet private key (for deploying the contract)
- A Pinata JWT token (sign up at [pinata.cloud](https://pinata.cloud))

**3. Compile the contract**

```bash
npm run compile
```

**4. Deploy to Sepolia**

Make sure your wallet has some Sepolia ETH, then:

```bash
npm run deploy
```

This deploys the Privabuild contract and saves the address to `lib/contract-config.json`.

**5. Run the app**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're good to go.

## Features

### Encrypted submissions
Your data is encrypted before it leaves your browser. The blockchain only sees:
- Your builder name (public)
- IPFS hash (points to encrypted data)
- Encrypted verification hash (via fhEVM)
- Timestamp (public)

The actual URLs? Encrypted and stored on IPFS. Nobody can read them without your permission.

### Access control
You control who sees what. Grant access to reviewers using fhEVM's native ACL system. Revoke it whenever you want. The contract deployer has zero access to your data—it's your submission, your rules.

### Live feed
See submissions in real-time. You'll see builder names and timestamps, but the actual project data stays locked with a 🔒 icon unless you have permission to decrypt it.

## Project structure

```
├── contracts/          # Solidity smart contracts
│   └── Privabuild.sol
├── scripts/            # Deployment scripts
├── lib/                # Core utilities
│   ├── fheUtils.ts     # fhEVM encryption logic
│   ├── ipfsStorage.ts  # IPFS upload/download
│   └── contractUtils.ts # Contract interactions
├── components/         # React components
│   ├── submission-form.tsx
│   ├── submissions-feed.tsx
│   └── grant-access.tsx
├── app/                # Next.js app directory
└── hardhat.config.js
```

## Smart contract

The contract is straightforward. It stores:
- Builder address
- Builder name (public)
- IPFS CID (public, but points to encrypted data)
- Encrypted hash (`euint256` via fhEVM)
- Timestamp

Key functions:
- `submit()` - Submit a new encrypted project
- `grantAccess()` - Give someone permission to decrypt your hash
- `revokeAccess()` - Remove their access
- `getSubmissionMeta()` - Get public metadata

## For developers

All the fhEVM logic lives in `lib/fheUtils.ts`. If you want to upgrade to a newer fhEVM version later, just update the imports there—everything else stays the same.

Client-side encryption uses TweetNaCl secretbox. The encryption key gets displayed once after submission (user needs to save it to decrypt their data later).

## Why this matters

Builder programs and bounty submissions are usually public. This means everyone can see what you're building before you're ready to share. With Privabuild, you can submit early, prove you submitted on-chain, but keep the details private until you're ready to reveal.

It's also a practical demo of fhEVM—showing how to use encrypted types (`euint256`), ACL management (`FHE.allow()`), and client-side encryption in a real app.

## License

MIT

## Built for

Zama Builder Program - demonstrating practical fhEVM usage with IPFS integration.
