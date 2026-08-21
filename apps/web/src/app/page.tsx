'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, 
  Target, 
  BarChart3, 
  Globe, 
  Brain, 
  Shield,
  ArrowRight,
  CheckCircle,
  Loader2,
  Video,
  Sparkles
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant Amplification',
    description: 'One-click distribution to 7+ platforms simultaneously. No manual posting, no platform switching.',
  },
  {
    icon: Brain,
    title: 'AI Video Optimization',
    description: 'Local LLMs rewrite captions, select hashtags, generate thumbnails, and optimize for each platform\'s algorithm.',
  },
  {
    icon: Target,
    title: 'Precision Targeting',
    description: 'Audience intelligence builds lookalike audiences from your best performers. Retarget engaged viewers automatically.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Unified dashboard with cross-platform metrics. Viral coefficient tracking, retention curves, revenue attribution.',
  },
  {
    icon: Globe,
    title: 'Zero API Costs',
    description: 'Self-hosted browser automation bypasses official APIs. No rate limits, no monthly fees, no platform dependency.',
  },
  {
    icon: Shield,
    title: 'Full Data Ownership',
    description: 'Your content, your data, your infrastructure. GDPR/CCPA compliant by default. Export anytime.',
  },
];

const stats = [
  { value: '7+', label: 'Platforms Supported' },
  { value: '0', label: 'API Costs/Month' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<5min', label: 'Avg Setup Time' },
];

const platforms = [
  { name: 'TikTok', color: 'from-pink-500 to-black', icon: Video },
  { name: 'Instagram Reels', color: 'from-purple-500 via-pink-500 to-orange-500', icon: Sparkles },
  { name: 'YouTube Shorts', color: 'from-red-600 to-red-400', icon: Video },
  { name: 'Facebook Reels', color: 'from-blue-600 to-blue-400', icon: Video },
  { name: 'X (Twitter)', color: 'from-gray-800 to-black', icon: Sparkles },
  { name: 'LinkedIn', color: 'from-blue-700 to-blue-500', icon: Target },
  { name: 'Pinterest', color: 'from-red-500 to-pink-500', icon: Sparkles },
];

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl gradient-text">
            <Zap className="h-6 w-6" />
            Amplify
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#platforms" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Platforms</Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="#docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/auth/signup">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-8 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>Version 2.0 — Now with Local AI & Browser Automation</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Amplify Your Videos
              <br />
              <span className="gradient-text">Across Every Platform</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              One upload. AI-optimized for every platform. Distributed automatically. 
              Real-time analytics. Zero API costs. Self-hosted on your infrastructure.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto mb-16">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email for early access"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting || submitted}
                  className="h-12 text-base"
                  required
                />
              </div>
              <Button type="submit" size="lg" disabled={isSubmitting || submitted} className="h-12 px-8">
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : submitted ? (
                  <CheckCircle className="h-5 w-5 mr-2" />
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
                {submitted && 'You\'re on the list!'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              Self-hosted • MIT Licensed • No vendor lock-in • Deploy in 5 minutes
            </p>
          </div>

          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Background decorative elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        </div>
      </section>

      {/* Platforms Section */}
      <section id="platforms" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Native Support for Every Platform</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Each platform has unique algorithm preferences. Amplify optimizes automatically for all of them.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 max-w-6xl mx-auto">
            {platforms.map((platform, i) => (
              <Link
                key={platform.name}
                href="#"
                className="group relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br"
                style={{ background: platform.color }}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300 flex flex-col items-center justify-center p-4">
                  <platform.icon className="h-10 w-10 text-white mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-white font-semibold text-center">{platform.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Amplification, Not Just Posting</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every feature is designed to maximize reach, engagement, and conversion — not just save time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <Card key={i} className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From Upload to Viral in 4 Steps</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              No complex workflows. No platform-specific knowledge required.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { step: '01', title: 'Upload', desc: 'Drag & drop or paste a link. We handle transcoding, compression, and format conversion automatically.' },
              { step: '02', title: 'Optimize', desc: 'Local AI rewrites captions, picks hashtags, generates thumbnails, and selects posting times per platform.' },
              { step: '03', title: 'Amplify', desc: 'Browser automation posts natively to all platforms. Engages with comments, follows back, triggers algorithms.' },
              { step: '04', title: 'Analyze', desc: 'Unified dashboard shows cross-platform performance. Viral coefficient, retention, revenue attribution.' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <Card className="pt-10 h-full">
                  <CardContent className="text-center">
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
                {i < 3 && (
                  <div className="absolute top-0 right-0 w-full h-10 hidden md:block">
                    <div className="w-full h-0.5 bg-border/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto bg-primary text-primary-foreground border-none">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Amplify?</h2>
              <p className="text-primary-foreground/80 mb-8 text-lg">
                Deploy on your infrastructure in 5 minutes. Start with the free tier — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-8 py-3" style={{ fontSize: '1.125rem' }}>
                    Deploy Free Now
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-3" style={{ fontSize: '1.125rem' }}>
                    Read Documentation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 font-bold text-xl gradient-text mb-4">
                <Zap className="h-6 w-6" />
                Amplify
              </Link>
              <p className="text-muted-foreground max-w-sm">
                The self-hosted video amplification platform. AI-powered optimization, 
                cross-platform distribution, and real-time analytics — zero API costs.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#platforms" className="hover:text-foreground transition-colors">Platforms</Link></li>
                <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          <Separator className="mb-8" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Amplify. MIT Licensed. Built in public.
            </p>
            <div className="flex items-center gap-6">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.68 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.083.083 0 0 0 .031.057 19.9 19.9 0 0 0 5.994 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.007-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.645.77 1.255 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.004-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.672-3.547-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}