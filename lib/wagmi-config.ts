import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

export function createWagmiConfig() {
  return getDefaultConfig({
    appName: "Privabuild",
    projectId: "695f7158f4e5e79f77218e2a1067c349",
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(
        process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || 
        "https://rpc.sepolia.org"
      ),
    },
    ssr: true,
  });
}


