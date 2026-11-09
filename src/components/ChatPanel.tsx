'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageSquare } from 'lucide-react'
import { ChatMessage, UserProfile } from '@/types/community'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

interface ChatPanelProps {
  roomId: string
  roomName: string
  currentUser: UserProfile
}

export function ChatPanel({ roomId, roomName, currentUser }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!roomId || !isSupabaseConfigured()) return

    const supabase = createClient()

    supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[])
      })

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on('broadcast', { event: 'chat-msg' }, ({ payload }) => {
        const newMsg = payload as ChatMessage
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url,
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, newMsg])
    setInput('')

    const supabase = createClient()
    await supabase.channel(`chat:${roomId}`).send({
      type: 'broadcast',
      event: 'chat-msg',
      payload: newMsg,
    })

    await supabase.from('messages').insert({
      id: newMsg.id,
      room_id: newMsg.room_id,
      user_id: newMsg.user_id,
      username: newMsg.username,
      avatar_url: newMsg.avatar_url,
      content: newMsg.content,
    })
  }

  return (
    <div className="flex h-[420px] flex-col rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl lg:h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-white">Chat • {roomName}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ao vivo
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <MessageSquare className="mb-2 h-7 w-7 opacity-30" />
            <p className="text-xs">Sem mensagens ainda. Mande um salve!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.user_id === currentUser.id
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <img
                    src={msg.avatar_url}
                    alt={msg.username}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isMe ? 'text-amber-400' : 'text-zinc-200'
                        }`}
                      >
                        {msg.username}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-zinc-300">
                      {msg.content}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 transition focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 p-1.5 text-zinc-950 transition hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
