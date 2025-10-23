import Image from "next/image"

export function Watermark() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03]">
        <Image
          src="/zama-logo.png"
          alt="Zama watermark"
          fill
          sizes="800px"
          className="object-contain"
          priority={false}
        />
      </div>
    </div>
  )
}
