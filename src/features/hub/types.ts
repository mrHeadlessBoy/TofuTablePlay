// Shapes the hub page loads for its campaign grid and active table cards

export type PublicCampaign = {
  id: string | number
  category: string
  title: string
  core_description: string
  creator_id?: string | null
  creator_name?: string
  template_name?: string
  template_author?: string
}

export type ActiveTable = {
  id: string | number
  table_code: string
  current_turn: number | string
  turn_phase: string
  head_table_id?: string | null
  campaigns?: { title?: string } | null
}
