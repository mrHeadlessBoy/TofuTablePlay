'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

function localizeAuthError(msg: string, isThai: boolean): string {
  if (/invalid login credentials/i.test(msg)) {
    return isThai
      ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
      : 'Invalid email or password. Please verify your credentials.'
  }
  if (/email not confirmed/i.test(msg)) {
    return isThai
      ? 'กรุณายืนยันอีเมลของคุณผ่านลิงก์ที่ได้รับก่อนเข้าสู่ระบบ'
      : 'Please confirm your email address via the link sent to your inbox before signing in.'
  }
  if (/user already registered/i.test(msg)) {
    return isThai
      ? 'อีเมลนี้ถูกลงทะเบียนแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านของคุณ'
      : 'This email is already registered. Please log in with your password.'
  }
  if (/password should be at least/i.test(msg)) {
    return isThai
      ? 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
      : 'Password must be at least 6 characters long.'
  }
  return msg
}

export default function LoginPage() {
  const { language } = useLanguage()
  const isThai = language === 'th'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'session-expired') {
        return isThai
          ? 'เซสชันของคุณหมดอายุแล้ว (จำกัด 6 ชั่วโมง) กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
          : 'Your session has expired (6-hour limit). Please log in again.'
      }
    }
    return ''
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const supabase = createClient()

    const params = new URLSearchParams(window.location.search)
    const nextParam = params.get('next')
    const targetPath =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/hub'

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetPath)}`,
        },
      })
      if (error) {
        setErrorMsg(localizeAuthError(error.message, isThai))
      } else {
        setErrorMsg(
          isThai
            ? 'ระบบได้ส่งอีเมลยืนยันไปยังกล่องข้อความของคุณแล้ว กรุณากดลิงก์เพื่อเปิดใช้งานบัญชี'
            : 'A confirmation email has been dispatched. Please click the link to verify your account.'
        )
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg(localizeAuthError(error.message, isThai))
      } else {
        document.cookie = `dnd_session_start=${Date.now()}; path=/; max-age=21600; SameSite=Lax`
        router.push(targetPath)
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-amber-200">
      {/* Top Header Bar */}
      <header className="border-b border-zinc-800/40 bg-zinc-950/70 backdrop-blur-xl px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isThai ? 'กลับหน้าแรก' : 'Back to Home'}</span>
        </Link>
        <LanguageToggle />
      </header>

      {/* Main Auth Form Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md surface-panel rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6">
          {/* Logo & Headline */}
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-center mb-3">
              <Image
                src="/assets/pictures/logo_tofutableplay.png"
                alt="TofuTablePlay"
                width={600}
                height={300}
                className="h-14 sm:h-16 w-auto center object-contain"
                priority
              />
            </div>
            <h1 className="text-xl text-center sm:text-2xl font-bold tracking-tight text-zinc-100">
              {isSignUp
                ? isThai
                  ? 'สร้างบัญชีผู้เล่นใหม่'
                  : 'Create Table Account'
                : isThai
                ? 'เข้าสู่อาณาจักร'
                : 'Enter the Realm'}
            </h1>
            <p className="text-xs text-center text-zinc-400 leading-relaxed">
              {isSignUp
                ? isThai
                  ? 'ลงทะเบียนเพื่อสร้างและเข้าร่วมแคมเปญบทบาทสมมติ'
                  : 'Sign up to create and join tabletop campaigns'
                : isThai
                ? 'เข้าสู่ระบบเพื่อดำเนินเรื่องราวการผจญภัยต่อ'
                : 'Log in to continue your tabletop adventure'}
            </p>
          </div>

          {/* Error Message Box */}
          {errorMsg && (
            <div className="rounded-xl bg-red-950/30 border border-red-900/50 p-3 text-xs text-red-300 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
                {isThai ? 'อีเมล (Email)' : 'Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                className="w-full rounded-xl border border-zinc-800/80 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
                {isThai ? 'รหัสผ่าน (Password)' : 'Password'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800/80 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                  <span>{isThai ? 'กำลังดำเนินการ...' : 'Processing...'}</span>
                </>
              ) : isSignUp ? (
                isThai ? 'ลงทะเบียน' : 'Sign Up'
              ) : (
                isThai ? 'เข้าสู่ระบบ' : 'Log In'
              )}
            </button>
          </form>

          {/* Toggle between Login and Signup */}
          <div className="text-center pt-2 border-t border-zinc-800/40 text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setErrorMsg('')
              }}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              {isSignUp
                ? isThai
                  ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'
                  : 'Already have an account? Log in'
                : isThai
                ? 'ยังไม่มีบัญชีผู้เล่น? สมัครสมาชิก'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="py-6 text-center text-[11px] text-zinc-600">
        TofuTablePlay &copy; 2026
      </footer>
    </div>
  )
}
