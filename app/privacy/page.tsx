import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Chat',
  description: 'Privacy policy for the Chat messenger web app',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#8696a0] text-sm mb-8">Last updated: October 2026</p>

        <div className="space-y-6 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-semibold text-lg mb-2">1. What we collect</h2>
            <p>
              When you sign in with Google, we receive your name, email address and profile
              photo. When you use the chat, we store your messages, shared photos and voice
              notes so they can be delivered to the people you chat with.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-lg mb-2">2. How we use it</h2>
            <p>
              Your information is used only to operate the messenger: identifying you to
              other users, delivering messages, and showing online status. We do not sell
              your data and we do not show ads.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-lg mb-2">3. Data storage</h2>
            <p>
              Data is stored securely on Supabase (database and file storage). Only people
              you chat with can see your messages, enforced by database access rules.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-lg mb-2">4. Your control</h2>
            <p>
              You can delete your messages at any time from inside the app. To delete your
              account data, contact us and we will remove it.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-lg mb-2">5. Contact</h2>
            <p>
              For privacy questions, reach out through the app. This is a personal project
              and we take your privacy seriously.
            </p>
          </section>
        </div>

        <Link href="/" className="inline-block mt-10 text-[#00a884] hover:underline">
          ← Back to Chat
        </Link>
      </div>
    </div>
  );
}
