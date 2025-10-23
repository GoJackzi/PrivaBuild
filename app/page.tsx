import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { SubmissionForm } from "@/components/submission-form"
import { SubmissionsFeed } from "@/components/submissions-feed"
import { GrantAccess } from "@/components/grant-access"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main>
        <Hero />
        <div className="container mx-auto px-4 pt-4 pb-12">
          <SubmissionForm />
        </div>

        <div className="container mx-auto px-4 py-12">
          <SubmissionsFeed />
        </div>

        <div className="container mx-auto px-4 py-12">
          <GrantAccess />
        </div>
      </main>
      <Footer />
    </div>
  )
}
