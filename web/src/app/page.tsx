import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoopMark } from "@/components/loop-mark";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/app");

  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="wordmark" href="/">REED</Link>
        <Show when="signed-out">
          <div className="landing-actions">
            <SignInButton mode="modal"><button className="button button-quiet">Sign in</button></SignInButton>
            <SignUpButton mode="modal"><button className="button button-primary">Create account</button></SignUpButton>
          </div>
        </Show>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Training, with memory</p>
          <h1>A coach that keeps the whole picture in view.</h1>
          <p className="hero-lede">Talk through decisions with Reed, understand what your training is doing, and return to the same account on every device.</p>
          <div className="hero-actions">
            <SignUpButton mode="modal"><button className="button button-primary button-large">Start with Reed</button></SignUpButton>
            <SignInButton mode="modal"><button className="button button-secondary button-large">I already have an account</button></SignInButton>
          </div>
        </div>
        <div className="hero-presence" aria-label="Reed mascot">
          <LoopMark size="hero" expression="listening" />
          <p>Listening for the signal, not just counting the work.</p>
        </div>
      </section>
      <section className="landing-strip" aria-label="Web capabilities">
        <span>Coach chat</span><span>Training history</span><span>Progress</span><span>Goals</span><span>Profile</span>
      </section>
    </main>
  );
}
