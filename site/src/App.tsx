import { useRef, useEffect, type MouseEvent } from "react"

function useTilt(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e: MouseEvent<HTMLDivElement>) => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`
    }

    const handleLeave = () => {
      el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg)"
    }

    el.addEventListener("mousemove", handleMove as unknown as EventListener)
    el.addEventListener("mouseleave", handleLeave)
    return () => {
      el.removeEventListener("mousemove", handleMove as unknown as EventListener)
      el.removeEventListener("mouseleave", handleLeave)
    }
  }, [ref])
}

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null!)
  useTilt(ref)
  return (
    <div
      ref={ref}
      className={`glass rounded-2xl p-8 glow transition-transform duration-200 ease-out ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  )
}

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">NexusAI</span>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#features" className="hover:text-white/90 transition-colors">Features</a>
          <a href="#about" className="hover:text-white/90 transition-colors">About</a>
          <a href="#cta" className="hover:text-white/90 transition-colors">Contact</a>
        </div>
        <button className="glass text-sm px-4 py-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all">
          Get Started
        </button>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl animate-pulse-glow pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-white/50 mb-8 animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          v2.0.0 — The Architect's Mind
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <span className="text-gradient">Think.</span>
          <br />
          <span className="text-gradient">Build.</span>
          <br />
          <span className="text-gradient">Evolve.</span>
        </h1>

        <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          A modular, skill-oriented framework for AI agents.
          Low token, high signal. Architecture first. Code second.
        </p>

        <div className="flex items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <button className="bg-white text-black px-8 py-3 rounded-full font-semibold text-sm hover:bg-white/90 transition-all">
            Explore the Framework
          </button>
          <button className="glass px-8 py-3 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all">
            Read the Docs
          </button>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-float">
        <div className="w-6 h-10 rounded-full border border-white/20 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-white/40" />
        </div>
      </div>
    </section>
  )
}

const features = [
  {
    icon: "🧠",
    title: "Decision Engine",
    desc: "Classifies tasks, routes to the right skill chain, and prioritizes with precision. Every input gets the right treatment.",
  },
  {
    icon: "🎯",
    title: "Context Engine",
    desc: "Builds minimal context windows, loads relevant memory, and eliminates noise before the agent thinks.",
  },
  {
    icon: "⚡",
    title: "Token Manager",
    desc: "Monitors budgets in real time. Triggers compression at 70%+ usage. Keeps responses lean and costs low.",
  },
  {
    icon: "🔍",
    title: "Quality Gates",
    desc: "Five-layer validation: Security → Style → Clarity → Conciseness → Completeness. Every output is a deliverable.",
  },
  {
    icon: "🔄",
    title: "Reflection Engine",
    desc: "Self-review after every task. Logs mistakes, captures improvements, feeds the evolution cycle.",
  },
  {
    icon: "📈",
    title: "Evolution Engine",
    desc: "Skills upgrade themselves over time. The framework gets better with every task, autonomously.",
  },
]

const stats = [
  { value: "137+", label: "Skills" },
  { value: "10", label: "Pre-built Agents" },
  { value: "12", label: "Skill Categories" },
  { value: "<2K", label: "Tokens per Response" },
]

function Features() {
  return (
    <section id="features" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-gradient">Modular by Design</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Eight engines working together. Each one purpose-built, replaceable, and measurable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <TiltCard key={i} className="group">
              <span className="text-2xl mb-4 block">{f.icon}</span>
              <h3 className="text-lg font-semibold text-white/90 mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </TiltCard>
          ))}
        </div>

        <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">{s.value}</div>
              <div className="text-sm text-white/30">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.02)_0%,transparent_60%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Built for Engineers Who Care About Quality</span>
            </h2>
            <p className="text-white/40 text-lg leading-relaxed mb-6">
              NexusAI is not another AI wrapper. It's a disciplined framework that bakes security, clarity, and conciseness into every interaction. 137 skills, 10 agents, zero fluff.
            </p>
            <div className="space-y-3">
              {["Architecture first. Code second.", "Low token, high signal.", "Self-correcting evolution loop.", "Security embedded in every layer."].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className="text-sm text-white/60">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <TiltCard className="p-10">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
                <span className="text-2xl">⎔</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Skill Architecture</h3>
              <div className="space-y-2 text-sm text-white/30 text-left">
                {["Identity → Goals → Workflow → Decision Tree", "Rules → Checklists → Metrics → Evolution"].map((line, i) => (
                  <div key={i} className="glass rounded-lg px-4 py-2">
                    <code className="text-xs">{line}</code>
                  </div>
                ))}
              </div>
            </div>
          </TiltCard>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section id="cta" className="py-32 relative">
      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <TiltCard className="p-12 md:p-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-gradient">Ready to Evolve Your Agent?</span>
          </h2>
          <p className="text-white/40 text-lg mb-8 max-w-lg mx-auto">
            Start building with NexusAI. Zero config, full control.
          </p>
          <button className="bg-white text-black px-10 py-4 rounded-full font-semibold text-base hover:bg-white/90 transition-all inline-flex items-center gap-2">
            Get Started
            <span className="text-lg">→</span>
          </button>
        </TiltCard>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/20">
        <span>NexusAI v2.0.0</span>
        <span>The Architect's Mind</span>
        <span>Architecture first. Code second.</span>
      </div>
    </footer>
  )
}

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!
    let animId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.5 + 0.5,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)"

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
}

export default function App() {
  return (
    <main className="relative">
      <Particles />
      <Navbar />
      <Hero />
      <Features />
      <About />
      <CTA />
      <Footer />
    </main>
  )
}
