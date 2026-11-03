/** Primeiro foco da página: pula a navegação e leva ao `<main id={target}>`. */
export function SkipLink({ target = 'conteudo' }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Pular para o conteúdo
    </a>
  )
}
