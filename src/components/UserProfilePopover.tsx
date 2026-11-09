'use client'

import { UserProfile, Role, PrankType } from '@/types/community'
import { PRANK_OPTIONS, PrankIcon } from './PrankStageOverlay'

interface UserProfilePopoverProps {
  member: UserProfile
  roles: Role[]
  currentRoleIds: string[]
  isOnline: boolean
  currentVoiceRoomName?: string | null
  canPrank: boolean
  onToggleRole: (userId: string, roleId: string) => void
  onTriggerPrank: (type: PrankType, target: UserProfile) => void
  onClose: () => void
}

export function formatRelativeTime(isoDate?: string, isOnline?: boolean): string {
  if (isOnline) return 'Online agora'
  if (!isoDate) return 'Offline há algum tempo'

  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) return `Visto há ${mins} min`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Visto há ${hours} ${hours === 1 ? 'hora' : 'horas'}`

  const days = Math.floor(hours / 24)
  return `Visto há ${days} ${days === 1 ? 'dia' : 'dias'}`
}

export function formatJoinDate(isoDate?: string): string {
  if (!isoDate) return 'Membro antigo'
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'Membro antigo'
  }
}

export function UserProfilePopover({
  member,
  roles,
  currentRoleIds,
  isOnline,
  currentVoiceRoomName,
  canPrank,
  onToggleRole,
  onTriggerPrank,
  onClose,
}: UserProfilePopoverProps) {
  const memberRolesObjs = roles
    .filter((r) => currentRoleIds.includes(r.id))
    .sort((a, b) => a.position - b.position)
  const primaryRole = memberRolesObjs[0] || roles[0]

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[#1f2023] bg-[#111214] shadow-2xl"
      >
        {/* Top Banner with Primary Role Color */}
        <div
          style={{ backgroundColor: primaryRole?.color || '#5865f2' }}
          className="h-16 w-full"
        />

        {/* Avatar & Basic Info */}
        <div className="relative px-4 pb-4">
          <div className="relative -mt-10 mb-2 inline-block">
            <img
              src={member.avatar_url}
              alt={member.username}
              className="h-20 w-20 rounded-full border-4 border-[#111214] object-cover"
            />
            <span
              className={`absolute right-1 bottom-1 h-4 w-4 rounded-full border-2 border-[#111214] ${
                isOnline ? 'bg-[#23a55a]' : 'bg-[#80848e]'
              }`}
            />
          </div>

          <div className="rounded-lg bg-[#232428] p-3.5 space-y-3">
            <div>
              <h4
                style={{ color: primaryRole?.color || '#ffffff' }}
                className="text-base font-extrabold"
              >
                {member.username}
              </h4>
              <p className="text-[11px] font-medium text-[#949ba4]">
                {formatRelativeTime(member.last_seen_at || member.updated_at, isOnline)}
              </p>
              {currentVoiceRoomName && (
                <p className="mt-1 text-[11px] font-bold text-[#23a55a]">
                  🔊 Conectado em: {currentVoiceRoomName}
                </p>
              )}
            </div>

            <div className="border-t border-[#2b2d31] pt-2.5">
              <div className="text-[10px] font-bold tracking-wider text-[#b5bac1] uppercase">
                Membro de Os Secos desde
              </div>
              <div className="mt-0.5 text-xs font-semibold text-zinc-200">
                {formatJoinDate(member.joined_at)}
              </div>
            </div>

            {/* Multiple Roles Selector (Discord Style Pill Checkboxes) */}
            <div className="border-t border-[#2b2d31] pt-2.5">
              <div className="mb-1.5 text-[10px] font-bold tracking-wider text-[#b5bac1] uppercase">
                Cargos (Clique para adicionar / remover)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => {
                  const hasRole = currentRoleIds.includes(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onToggleRole(member.id, r.id)}
                      style={{
                        backgroundColor: hasRole ? `${r.color}30` : '#111214',
                        borderColor: hasRole ? r.color : '#2b2d31',
                        color: hasRole ? '#ffffff' : '#949ba4',
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold transition hover:brightness-110"
                    >
                      <span
                        style={{ backgroundColor: r.color }}
                        className="h-2.5 w-2.5 rounded-full"
                      />
                      <span>{r.name}</span>
                      {hasRole && <span className="text-[10px] text-emerald-400">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Community 3D Pranks with Voice Filter */}
            {canPrank && (
              <div className="border-t border-[#2b2d31] pt-2.5">
                <div className="mb-1.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                  Zoar na Call (Cena 3D + Efeito na Voz dele por 15s)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRANK_OPTIONS.map((p) => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => {
                        onTriggerPrank(p.type, member)
                        onClose()
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded bg-[#2b2d31] px-2.5 py-2 text-[11px] font-bold text-zinc-100 hover:bg-[#35373c]"
                    >
                      <PrankIcon type={p.type} className="h-4 w-4 shrink-0 text-amber-400" />
                      <span className="truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
