"use client"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="text-2xl font-bold text-[#ffd60a]">PrivaBuild</div>

        <div className="flex items-center gap-6">
          <a href="#home" className="text-sm text-[#ffd60a] hover:text-[#ffd60a]/80">
            Home
          </a>
          <a href="#submissions" className="text-sm text-[#ffd60a] hover:text-[#ffd60a]/80">
            Submissions
          </a>
        </div>
      </div>
    </nav>
  )
}
