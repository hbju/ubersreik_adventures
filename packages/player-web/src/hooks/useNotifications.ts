import { useEffect, useRef, useState } from 'react'
import { usePlayerNavigation } from '../context/PlayerNavigationContext'
import { usePlayerSession } from '../context/PlayerSessionContext'

export interface NotificationCounts {
  chat: number
  journal: number
}

/**
 * Tracks unread/unseen counts for chat and journal.
 * Resets when the corresponding view becomes active.
 * Purely in-memory — resets on reload.
 */
export function useNotifications(): NotificationCounts {
  const { activeView } = usePlayerNavigation()
  const { playerData } = usePlayerSession()

  const [chatCount, setChatCount] = useState(0)
  const [journalCount, setJournalCount] = useState(0)

  // Track previous array lengths to detect new arrivals
  const prevChatLen = useRef(playerData.chatMessages.length)
  const prevJournalLen = useRef(playerData.journalEntries.length)

  // Detect new chat messages
  useEffect(() => {
    const currentLen = playerData.chatMessages.length
    if (currentLen > prevChatLen.current && activeView !== 'chat') {
      setChatCount((c) => c + (currentLen - prevChatLen.current))
    }
    prevChatLen.current = currentLen
  }, [playerData.chatMessages.length, activeView])

  // Detect new journal entries
  useEffect(() => {
    const currentLen = playerData.journalEntries.length
    if (currentLen > prevJournalLen.current && activeView !== 'journal') {
      setJournalCount((c) => c + (currentLen - prevJournalLen.current))
    }
    prevJournalLen.current = currentLen
  }, [playerData.journalEntries.length, activeView])

  // Reset chat count when viewing chat
  useEffect(() => {
    if (activeView === 'chat') {
      setChatCount(0)
    }
  }, [activeView])

  // Reset journal count when viewing journal
  useEffect(() => {
    if (activeView === 'journal') {
      setJournalCount(0)
    }
  }, [activeView])

  return { chat: chatCount, journal: journalCount }
}
