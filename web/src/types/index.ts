export type PaneStatus = 'idle' | 'running' | 'agent' | 'waiting_approval'

export interface AgentMetadata {
  model?: string
  mode?: 'ask' | 'plan' | 'build'
  persona?: string
  lastAction?: string
}

export interface TerminalPane {
  id: string
  sessionId: string // ID matched with backend PTY session
  sequenceId: number
  title: string
  shell: string // "nio", "bash", "zsh", "sh"
  args?: string[]
  cwd?: string
  status: PaneStatus
  agentMetadata?: AgentMetadata
  createdAt: number
}

export interface WorkspaceSession {
  id: string
  name: string
  cwd: string
  panes: TerminalPane[]
  activePaneId: string | null
  createdAt: number
}

export interface WsRequest {
  id: number
  command: string
  args?: Record<string, any>
}

export interface WsReply {
  id: number
  ok: boolean
  result?: any
  error?: string
}

export interface WsEvent {
  event: string
  payload: any
}
