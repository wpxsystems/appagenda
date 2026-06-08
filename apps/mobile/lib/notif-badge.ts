// Store reativo leve para o badge de notificações não lidas na tab bar.
// Evita Context/Provider: TabBar e NotifScreen compartilham esse estado via subscription.

type Listener = () => void

let _count = 0
let _listeners: Listener[] = []

export const notifBadge = {
  get: () => _count,

  set: (n: number) => {
    _count = n
    _listeners.forEach(fn => fn())
  },

  subscribe: (fn: Listener) => {
    _listeners.push(fn)
    return () => {
      _listeners = _listeners.filter(l => l !== fn)
    }
  },
}
