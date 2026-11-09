export interface CommunityEmote {
  id: string
  code: string
  label: string
  col: number // 0 to 4
  row: number // 0 to 2
}

export const COMMUNITY_EMOTES: CommunityEmote[] = [
  // Row 0
  { id: 'laugh', code: ':risada:', label: 'Risada Seca', col: 0, row: 0 },
  { id: 'waiting', code: ':esperando:', label: 'Esperando na Cova', col: 1, row: 0 },
  { id: 'cool', code: ':mec:', label: 'Mec / Suave', col: 2, row: 0 },
  { id: 'noterra', code: ':semterra:', label: 'Sem Terra', col: 3, row: 0 },
  { id: 'sleep', code: ':mimir:', label: 'A Mimir no Caixão', col: 4, row: 0 },

  // Row 1
  { id: 'rage', code: ':tilt:', label: 'Tiltado / Fogo', col: 0, row: 1 },
  { id: 'ossecos', code: ':ossecos:', label: 'Os Secos', col: 1, row: 1 },
  { id: 'facepalm', code: ':facepalm:', label: 'Decepção', col: 2, row: 1 },
  { id: 'coffee', code: ':cafe:', label: 'Cafezinho Seco', col: 3, row: 1 },
  { id: 'up', code: ':subindo:', label: 'Saindo da Terra', col: 4, row: 1 },

  // Row 2
  { id: 'love', code: ':apaixonado:', label: 'Apaixonado', col: 0, row: 2 },
  { id: 'carry', code: ':carregando:', label: 'Carregando o Time', col: 1, row: 2 },
  { id: 'alert', code: ':espiando:', label: 'Espiando (!)', col: 2, row: 2 },
  { id: 'reaper', code: ':ceifador:', label: 'Ceifador', col: 3, row: 2 },
  { id: 'rip', code: ':rip:', label: 'R.I.P. Eu', col: 4, row: 2 },
]

export function getEmoteByCode(code: string): CommunityEmote | undefined {
  return COMMUNITY_EMOTES.find((e) => e.code === code)
}
