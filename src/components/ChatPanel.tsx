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
  onClose?: () => void
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
          size={isSingleEmote ? 60 : 30}
          className="mx-0.5 my-0.5"
        />
      )
    }
    return <span key={idx}>{part}</span>
  })
}

export function ChatPanel({ roomId, roomName, currentUser, onClose }: ChatPanelProps) {
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
    <aside className="relative flex h-full w-full flex-col border-l border-[#1f2023] bg-[#2b2d31] sm:w-80">
      {/* Discord Chat Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f2023] px-4">
        <span className="text-xs font-bold text-white"># {roomName.toLowerCase()}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded bg-[#35373c] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#404249] hover:text-white"
          >
            Ocultar Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-zinc-400">
            Início do canal #{roomName.toLowerCase()}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <img
                  src={msg.avatar_url}
                  alt={msg.username}
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isMe ? 'text-[#f2f3f5]' : 'text-[#dbdee1]'
                      }`}
                    >
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-[#949ba4]">
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-0.5 break-words text-xs leading-relaxed text-[#dbdee1]">
                    {renderMessageWithEmotes(msg.content)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emote Picker Popover */}
      {showEmotes && (
        <div className="absolute right-3 bottom-16 left-3 z-20 rounded-lg border border-[#1f2023] bg-[#111214] p-2.5 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-200">Emotes Os Secos</span>
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
                className="flex cursor-pointer flex-col items-center justify-center rounded bg-[#2b2d31] p-1.5 hover:bg-[#35373c]"
                title={emote.label}
              >
                <EmoteSprite emote={emote} size={38} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Discord Message Input Bar */}
      <form onSubmit={sendMessage} className="p-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-[#383a40] px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Conversar em #${roomName.toLowerCase()}`}
            className="flex-1 bg-transparent text-xs text-white placeholder-[#949ba4] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowEmotes((s) => !s)}
            className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold ${
              showEmotes
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#1e1f22]'
            }`}
          >
            Emotes
          </button>
        </div>
      </form>
    </aside>
  )
}
