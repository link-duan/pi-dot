import { create } from 'zustand'
import { createChatState, type ChatState } from './state'

export const useChat = create<ChatState>(() => createChatState())
