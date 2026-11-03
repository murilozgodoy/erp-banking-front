import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'erpia-theme'

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Tema claro/escuro: aplica em `<html data-theme>` e salva a escolha (o index.html a lê). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)
  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Sem storage (modo privado): vale só nesta aba.
    }
    setTheme(next)
  }, [])
  return { theme, toggle }
}
