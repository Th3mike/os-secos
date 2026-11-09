'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatMessage, UserProfile } from '@/types/community'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { COMMUNITY_EMOTES, getEmoteByCode } from '@/lib/emotes'
import { EmoteSprite } from './EmoteSprite'

interface ChatPanelProps {
  roomId: string
  roomName: string
  currentUser: UserProfile
}

function renderMessageWithEmotes(content: string) {
  const parts = content.split(/(:[a-z0-9_]+:)/gi)
  const nonEmpty = parts.filter((p) => p.trim() !== '')
  const isSingleEmote =
    nonEmpty.length === 1 && Boolean(getEmoteByCode(nonEmpty[0].toLowerCase()))

  return parts.map((part, idx) => {
    const emote = getEmoteByCode(part.toLowerCase())
    if (emote) {
      return (
        <EmoteSprite
          key={idx}
          emote={emote}
          size={isSingleEmote ? 64 : 32}
          className="mx-0.5 my-0.5"
        />
      )
    }
    return <span key={idx}>{part}</span>
  })
}

export function ChatPanel({ roomId, roomName, currentUser }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [showEmotes, setShowEmotes] = useState(false)
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

  const sendRawMessage = async (text: string) => {
    if (!text.trim()) return

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url,
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, newMsg])

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    const text = input
    setInput('')
    setShowEmotes(false)
    await sendRawMessage(text)
  }

  const handleSelectEmote = async (code: string) => {
    setShowEmotes(false)
    await sendRawMessage(code)
  }

  return (
    <div className="relative flex h-[400px] flex-col rounded-lg border border-[#26282c] bg-[#16171a] lg:h-[calc(100vh-76px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#26282c] px-3.5 py-2.5">
        <span className="text-xs font-semibold text-zinc-200">Chat • {roomName}</span>
        <span className="text-[11px] text-zinc-500">Tempo real</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-zinc-500">
            Nenhuma mensagem ainda.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <img
                  src={msg.avatar_url}
                  alt={msg.username}
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isMe ? 'text-white' : 'text-zinc-300'
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
                  <div className="mt-0.5 break-words text-xs leading-relaxed text-zinc-200">
                    {renderMessageWithEmotes(msg.content)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emotes Drawer */}
      {showEmotes && (
        <div className="absolute right-2.5 bottom-14 left-2.5 z-20 rounded-lg border border-[#32353b] bg-[#111214] p-2.5 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300">Emotes Os Secos</span>
            <button
              type="button"
              onClick={() => setShowEmotes(false)}
              className="cursor-pointer text-[11px] text-zinc-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {COMMUNITY_EMOTES.map((emote) => (
              <button
                key={emote.id}
                type="button"
                onClick={() => handleSelectEmote(emote.code)}
                className="flex cursor-pointer flex-col items-center justify-center rounded bg-[#1b1d21] p-1.5 hover:bg-[#282b30]"
                title={emote.label}
              >
                <EmoteSprite emote={emote} size={40} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={sendMessage} className="border-t border-[#26282c] p-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowEmotes((s) => !s)}
            className={`cursor-pointer rounded px-2.5 py-1.5 text-xs font-medium ${
              showEmotes
                ? 'bg-zinc-200 text-zinc-900'
                : 'bg-[#23252a] text-zinc-200 hover:bg-[#2f3238]'
            }`}
          >
            Emotes
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva uma mensagem..."
            className="flex-1 rounded border border-[#2b2d31] bg-[#111214] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="cursor-pointer rounded bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  )
}
