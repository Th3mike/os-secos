'use client'

import { useEffect, useRef, useState } from 'react'
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
      .limit(40)
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
    <div className="osrs-panel flex flex-col p-2">
      <div className="mb-1.5 flex items-center justify-between border-b border-[#5c5040] pb-1">
        <span className="text-xs font-bold text-[#ffff00] osrs-text-shadow">
          Public Chat - {roomName}
        </span>
        <span className="text-[11px] text-[#00ff00] osrs-text-shadow">On</span>
      </div>

      {/* Classic OSRS Parchment Chatbox */}
      <div className="osrs-parchment h-40 overflow-y-auto p-2 text-xs leading-relaxed sm:h-44">
        {messages.length === 0 ? (
          <p className="text-[#4a3f30] italic">
            Bem-vindo ao chat de Os Secos. Digite sua mensagem abaixo...
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="mb-0.5 break-words">
              <span className="font-bold text-[#000000]">{msg.username}: </span>
              <span className="font-semibold text-[#0000ff]">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-1.5 flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${currentUser.username}: *digite aqui e aperte Enter*`}
          className="osrs-inset flex-1 px-2.5 py-1.5 text-xs text-[#ffff00] placeholder-[#8c7b65] focus:outline-none"
        />
        <button type="submit" className="osrs-btn px-3 py-1.5 text-xs">
          Enviar
        </button>
      </form>
    </div>
  )
}
