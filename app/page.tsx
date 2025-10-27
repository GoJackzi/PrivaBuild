import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { SubmissionForm } from "@/components/submission-form"
import { SubmissionsFeed } from "@/components/submissions-feed"
import { GrantAccess } from "@/components/grant-access"
import { MySubmissions } from "@/components/my-submissions"
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

        {/* Side-by-side layout for Manage Access Control and My Submissions */}
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GrantAccess />
            <MySubmissions />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
