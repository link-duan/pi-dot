import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { MessageAction } from './MessageAction'

export function CopyAction({ text, label = 'Copy' }: { text: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <MessageAction
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard.writeText(text()).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    />
  )
}
