import type { ReactNode } from 'react'

/**
 * Markdown mínimo e seguro das respostas do assistente: parágrafos, listas (com marcador ou
 * numeradas) e **negrito**. Tudo vira texto React (escapado); nenhum HTML da resposta é
 * interpretado. Títulos (`# …`) viram parágrafo em negrito; o resto do markdown sai como texto.
 */

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'strong'; text: string }
  | { kind: 'ul' | 'ol'; items: string[]; start: number }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  let current = null as Block | null
  const flush = () => {
    if (current) blocks.push(current)
    current = null
  }

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const heading = bullet || numbered ? null : HEADING.exec(line)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      const text = bullet ? bullet[1] : numbered![2]
      if (current?.kind !== kind) {
        flush()
        current = { kind, items: [], start: numbered ? Number(numbered[1]) : 1 }
      }
      current.items.push(text)
    } else if (heading) {
      flush()
      blocks.push({ kind: 'strong', text: heading[1] })
    } else if (current && current.kind !== 'p' && current.kind !== 'strong' && /^\s+/.test(raw)) {
      // Continuação indentada do último item da lista.
      current.items[current.items.length - 1] += ` ${line.trim()}`
    } else {
      if (current?.kind !== 'p') {
        flush()
        current = { kind: 'p', lines: [] }
      }
      current.lines.push(line.trim())
    }
  }
  flush()
  return blocks
}

/** `**negrito**` → <strong>; o resto, texto puro. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-[0.9375rem] leading-relaxed text-ink">
      {parseBlocks(source).map((block, index) => {
        if (block.kind === 'p') {
          return (
            <p key={index}>
              {block.lines.map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {inline(line)}
                </span>
              ))}
            </p>
          )
        }
        if (block.kind === 'strong') {
          return (
            <p key={index} className="font-semibold">
              {inline(block.text)}
            </p>
          )
        }
        const items = block.items.map((item, i) => (
          <li key={i} className="pl-1">
            {inline(item)}
          </li>
        ))
        return block.kind === 'ul' ? (
          <ul key={index} className="list-disc space-y-1 pl-5 marker:text-ink-faint">
            {items}
          </ul>
        ) : (
          <ol
            key={index}
            start={block.start}
            className="tabular list-decimal space-y-1 pl-5 marker:text-ink-faint"
          >
            {items}
          </ol>
        )
      })}
    </div>
  )
}
