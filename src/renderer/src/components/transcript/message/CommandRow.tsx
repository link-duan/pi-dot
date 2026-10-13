import { UserBubble } from './UserBubble'

/**
 * An extension command the user sent, colored as in the Composer. It is not in the session file,
 * so it has no time and cannot be edited or forked.
 */
export function CommandRow({ text }: { text: string }) {
  const end = text.search(/\s|$/)
  return (
    <UserBubble>
      <span className="text-command">{text.slice(0, end)}</span>
      {text.slice(end)}
    </UserBubble>
  )
}
