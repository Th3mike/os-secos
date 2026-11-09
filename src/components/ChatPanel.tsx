'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatMessage, UserProfile, Role } from '@/types/community'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { COMMUNITY_EMOTES, getEmoteByCode } from '@/lib/emotes'
import { EmoteSprite } from './EmoteSprite'

interface ChatPanelProps {
  roomId: string
  roomName: string
  currentUser: UserProfile
  roles?: Role[]
  memberRoles?: Record<string, string[]>
  fullView?: boolean
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

async function compressImageToDataUrl(
  file: File,
  maxWidth = 1440,
  quality = 0.84
): Promise<{ dataUrl: string; blob: Blob }> {
  if (file.type === 'image/gif') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Falha ao ler GIF'))
      reader.readAsDataURL(file)
    })
    return { dataUrl, blob: file }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let width = img.naturalWidth || img.width
      let height = img.naturalHeight || img.height
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/webp', quality)
      canvas.toBlob(
        (blob) => {
          resolve({
            dataUrl,
            blob: blob || file,
          })
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao processar imagem'))
    }
    img.src = objectUrl
  })
}

export function ChatPanel({
  roomId,
  roomName,
  currentUser,
  roles = [],
  memberRoles = {},
  fullView = false,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [showEmotes, setShowEmotes] = useState(false)
  const [pendingImage, setPendingImage] = useState<{
    file: File
    previewUrl: string
    name: string
  } | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
      .limit(60)
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

  const attachImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    try {
      const { dataUrl } = await compressImageToDataUrl(file)
      setPendingImage({
        file,
        previewUrl: dataUrl,
        name: file.name || `print-${Date.now()}.png`,
      })
    } catch {
      const fallbackUrl = URL.createObjectURL(file)
      setPendingImage({
        file,
        previewUrl: fallbackUrl,
        name: file.name || `print-${Date.now()}.png`,
      })
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await attachImageFile(file)
        }
        return
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await attachImageFile(file)
    }
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await attachImageFile(file)
    }
  }

  const uploadOrGetImageUrl = async (
    file: File,
    fallbackDataUrl: string
  ): Promise<string> => {
    if (!isSupabaseConfigured()) return fallbackDataUrl
    try {
      const { blob } = await compressImageToDataUrl(file)
      const supabase = createClient()
      const ext = file.type === 'image/gif' ? 'gif' : 'webp'
      const path = `${roomId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
      const { error } = await supabase.storage
        .from('chat-images')
        .upload(path, blob, {
          contentType: file.type === 'image/gif' ? 'image/gif' : 'image/webp',
          upsert: false,
        })
      if (!error) {
        const { data } = supabase.storage.from('chat-images').getPublicUrl(path)
        if (data?.publicUrl) return data.publicUrl
      }
    } catch {
      // Fallback to compressed Data URL below
    }
    return fallbackDataUrl
  }

  const sendRawMessage = async (text: string, imageToUpload?: typeof pendingImage) => {
    const trimmed = text.trim()
    if (!trimmed && !imageToUpload) return

    setIsSending(true)
    try {
      let finalImageUrl: string | null = null
      if (imageToUpload) {
        finalImageUrl = await uploadOrGetImageUrl(
          imageToUpload.file,
          imageToUpload.previewUrl
        )
      }

      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        room_id: roomId,
        user_id: currentUser.id,
        username: currentUser.username,
        avatar_url: currentUser.avatar_url,
        content: trimmed,
        image_url: finalImageUrl,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, newMsg])

      const supabase = createClient()
      await supabase.channel(`chat:${roomId}`).send({
        type: 'broadcast',
        event: 'chat-msg',
        payload: newMsg,
      })

      const { error } = await supabase.from('messages').insert({
        id: newMsg.id,
        room_id: newMsg.room_id,
        user_id: newMsg.user_id,
        username: newMsg.username,
        avatar_url: newMsg.avatar_url,
        content: newMsg.content,
        image_url: newMsg.image_url,
      })

      // Caso a coluna image_url não exista no banco, salva embutido no content ou sem erro
      if (error && newMsg.image_url) {
        await supabase.from('messages').insert({
          id: newMsg.id,
          room_id: newMsg.room_id,
          user_id: newMsg.user_id,
          username: newMsg.username,
          avatar_url: newMsg.avatar_url,
          content: newMsg.content
            ? `${newMsg.content}\n[img]${newMsg.image_url}[/img]`
            : `[img]${newMsg.image_url}[/img]`,
        })
      }
    } finally {
      setIsSending(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && !pendingImage) || isSending) return
    const text = input
    const img = pendingImage
    setInput('')
    setPendingImage(null)
    setShowEmotes(false)
    await sendRawMessage(text, img)
  }

  const handleSelectEmote = async (code: string) => {
    setShowEmotes(false)
    await sendRawMessage(code)
  }

  const getUserRoles = (userId: string): Role[] => {
    const rIds = memberRoles[userId] || ['seco-raiz']
    return roles
      .filter((r) => rIds.includes(r.id))
      .sort((a, b) => a.position - b.position)
  }

  const extractMessageParts = (msg: ChatMessage): { text: string; imageUrl: string | null } => {
    let text = msg.content || ''
    let imageUrl = msg.image_url || null
    const match = text.match(/\[img\]([\s\S]*?)\[\/img\]/)
    if (match) {
      if (!imageUrl) imageUrl = match[1]
      text = text.replace(match[0], '').trim()
    }
    return { text, imageUrl }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false)
      }}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`relative flex h-full flex-col bg-[#313338] ${
        fullView ? 'flex-1' : 'w-full border-l border-[#1f2023] sm:w-80'
      }`}
    >
      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#5865f2] bg-[#111214]/85 text-center backdrop-blur-sm">
          <div className="rounded-full bg-[#5865f2]/20 p-3 text-[#5865f2]">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-2 text-sm font-bold text-white">Solte a imagem ou print aqui</p>
          <p className="text-xs text-zinc-400">Enviar para #{roomName.toLowerCase()}</p>
        </div>
      )}

      {/* Header */}
      {!fullView && (
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f2023] bg-[#2b2d31] px-4">
          <span className="text-xs font-bold text-white"># {roomName.toLowerCase()}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded bg-[#35373c] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#404249] hover:text-white"
            >
              Fechar
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-white">
              Bem-vindo ao início de #{roomName.toLowerCase()}
            </p>
            <p className="mt-1 text-xs text-[#949ba4]">
              Este é o começo do histórico deste canal. Você também pode colar prints (Ctrl+V) ou enviar imagens!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const userRoles = getUserRoles(msg.user_id)
            const primaryRole = userRoles[0]
            const { text, imageUrl } = extractMessageParts(msg)
            return (
              <div key={msg.id} className="flex items-start gap-3">
                <img
                  src={msg.avatar_url}
                  alt={msg.username}
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      style={{ color: primaryRole?.color || '#f2f3f5' }}
                      className="text-xs font-bold"
                    >
                      {msg.username}
                    </span>
                    {userRoles.map((role) => (
                      <span
                        key={role.id}
                        style={{
                          backgroundColor: `${role.color}22`,
                          color: role.color,
                          borderColor: `${role.color}55`,
                        }}
                        className="rounded border px-1.5 py-0.2 text-[9px] font-bold"
                      >
                        {role.name}
                      </span>
                    ))}
                    <span className="text-[10px] text-[#949ba4]">
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {text && (
                    <div className="mt-0.5 break-words text-xs leading-relaxed text-[#dbdee1]">
                      {renderMessageWithEmotes(text)}
                    </div>
                  )}
                  {imageUrl && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(imageUrl)}
                        className="group relative inline-block cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#1e1f22] text-left shadow-md transition hover:border-[#5865f2]/60"
                        title="Clique para ampliar a imagem"
                      >
                        <img
                          src={imageUrl}
                          alt="Anexo enviado no chat"
                          className="max-h-72 max-w-full rounded-lg object-contain transition group-hover:brightness-105 sm:max-w-sm"
                          loading="lazy"
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emote Picker Popover */}
      {showEmotes && (
        <div className="absolute right-4 bottom-16 z-20 w-72 rounded-lg border border-[#1f2023] bg-[#111214] p-2.5 shadow-2xl">
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

      {/* Pending Image Preview (PrintScreen / Upload) */}
      {pendingImage && (
        <div className="mx-3.5 mb-2 flex items-center justify-between gap-3 rounded-lg border border-[#1f2023] bg-[#2b2d31] p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={pendingImage.previewUrl}
              alt="Preview"
              className="h-14 w-14 shrink-0 rounded-md border border-white/10 bg-[#1e1f22] object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{pendingImage.name}</p>
              <p className="text-[10px] text-emerald-400">
                Pronto para enviar • Enter para confirmar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            className="cursor-pointer rounded-md bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/30"
            title="Remover anexo"
          >
            Remover
          </button>
        </div>
      )}

      {/* Discord Message Input Bar */}
      <form onSubmit={sendMessage} className="p-3.5 pt-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-2 rounded-lg bg-[#383a40] px-3 py-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4e5058] text-zinc-200 transition hover:bg-[#5865f2] hover:text-white"
            title="Enviar imagem ou print (ou cole com Ctrl+V)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              pendingImage
                ? 'Adicione um comentário na imagem (opcional)...'
                : `Conversar ou colar print (Ctrl+V) em #${roomName.toLowerCase()}`
            }
            className="flex-1 bg-transparent text-xs text-white placeholder-[#949ba4] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded bg-[#2b2d31] px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-[#1e1f22] hover:text-white"
            title="Anexar imagem / screenshot"
          >
            📷 Print
          </button>
          <button
            type="button"
            onClick={() => setShowEmotes((s) => !s)}
            className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-semibold ${
              showEmotes
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#1e1f22]'
            }`}
          >
            Emotes
          </button>
          {(pendingImage || input.trim()) && (
            <button
              type="submit"
              disabled={isSending}
              className="cursor-pointer rounded bg-[#5865f2] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#4752c4] disabled:opacity-50"
            >
              {isSending ? '...' : 'Enviar'}
            </button>
          )}
        </div>
      </form>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[92vw] flex-col items-center"
          >
            <img
              src={lightboxUrl}
              alt="Imagem ampliada"
              className="max-h-[82vh] max-w-[90vw] rounded-lg border border-white/15 object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={lightboxUrl}
                download={`os-secos-${Date.now()}.webp`}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer rounded-md bg-[#2b2d31] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#35373c] hover:text-white"
              >
                Abrir / Baixar original
              </a>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="cursor-pointer rounded-md bg-red-500/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
