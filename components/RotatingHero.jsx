'use client'

import { useState, useEffect } from 'react'

const PHRASES = [
  'Van aantekening naar briefing',
  'Van briefing naar artikel',
  'Van interview naar persbericht',
  'Van gesprek naar debrief',
  'Van opname naar samenvatting',
]

export default function RotatingHero() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length)
        setVisible(true)
      }, 500)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
      <span
        className="block min-h-[2.3em] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {PHRASES[index]}
      </span>
      <span className="text-orange">In seconden.</span>
    </h1>
  )
}
