'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Loader2, ChefHat } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function ChefAiChat({ recipeId, open, onClose }: { recipeId: string; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [waitingFirstChunk, setWaitingFirstChunk] = useState(false)
  const startedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      startedRef.current = false
      return
    }
    if (!startedRef.current) {
      startedRef.current = true
      streamReply([])
    }
  }, [open])

  async function streamReply(nextMessages: ChatMessage[]) {
    setStreaming(true)
    setWaitingFirstChunk(true)
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    try {
      const res = await fetch(`/api/recipes/${recipeId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      if (!res.ok || !res.body) throw new Error('Chef AI unavailable')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          const data = line.slice(6)
          if (data === '[DONE]') return
          const parsed = JSON.parse(data)
          setWaitingFirstChunk(false)
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + parsed.text } : m))
        }
      }
    } catch {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content || 'Chef AI is unavailable right now.' } : m))
    } finally {
      setStreaming(false)
      setWaitingFirstChunk(false)
    }
  }

  function send() {
    const text = input.trim()
    if (!text || streaming) return
    const nextMessages: ChatMessage[] = [...messages.filter(m => m.content.trim()), { role: 'user', content: text }]
    setInput('')
    streamReply(nextMessages)
  }

  return (
    <BottomSheet open={open} onClose={onClose} zIndex="top" maxHeight="90vh">
      <div className="flex flex-col h-[78vh] px-4 pb-4">
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-cooking-subtle text-cooking flex items-center justify-center"><ChefHat className="w-4 h-4" /></span>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">Chef AI</h3>
              <p className="text-xs text-muted-foreground">Step-by-step cooking coach</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${message.role === 'user' ? 'bg-brand text-brand-foreground' : 'bg-card border border-border text-foreground'}`}>
                {message.content || (waitingFirstChunk && index === messages.length - 1 ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> typing…</span> : '')}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Ask a question, or say done…" className="min-h-11 max-h-28 resize-none bg-card" disabled={streaming} />
          <Button onClick={send} disabled={streaming || !input.trim()} className="self-end h-11 px-3 bg-brand hover:bg-brand/90 text-brand-foreground">
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
