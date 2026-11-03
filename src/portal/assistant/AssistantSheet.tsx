import { AlertCircle, ArrowRight, ArrowUp, SquarePen } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { Link, useNavigate } from 'react-router'

import { Faisca, Marca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { number } from '../lib/format'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

import { useAssistantContext } from './context'
import { Markdown } from './markdown'
import { screenContext, thinkingStatus } from './suggestions'
import { MAX_CHARS, type AssistantFailure, type ChatEntry } from './useAssistant'

const EASE = [0.16, 1, 0.3, 1] as const
/** O contador aparece perto do limite. */
const COUNTER_FROM = MAX_CHARS - 200
const DISCLAIMER =
  'Respostas geradas por IA com base nos dados da sua empresa. Confira antes de decidir.'

/** Só rotas internas do portal viram botão (a resposta da IA é tratada como dado). */
/** Segundos que faltam até `until` (atualiza a cada segundo); 0 quando já passou. */
function useSecondsLeft(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))
}

function isPortalRoute(rota: string) {
  return rota === '/app' || /^\/app[/?#]/.test(rota)
}

const chip =
  'inline-flex items-center rounded-full border border-line-strong bg-surface px-3 text-left text-sm text-ink transition-colors duration-150 hover:border-ink-faint hover:bg-sunken h-8 max-sm:min-h-11 max-sm:h-auto max-sm:py-2'

interface Turn {
  question: ChatEntry
  answer?: Extract<ChatEntry, { role: 'assistant' }>
}

function toTurns(entries: ChatEntry[]): Turn[] {
  const turns: Turn[] = []
  for (const entry of entries) {
    if (entry.role === 'user') turns.push({ question: entry })
    else if (turns.length && !turns[turns.length - 1].answer) {
      turns[turns.length - 1].answer = entry
    }
  }
  return turns
}

/** Painel do assistente: estado vazio com sugestões da tela, conversa e o campo de pergunta. */
export function AssistantSheet() {
  const { open, close, chat } = useAssistantContext()
  const composer = useRef<HTMLTextAreaElement>(null)
  const hasConversation = chat.entries.length > 0 || chat.pendingQuestion !== null
  // O botão clicado some (a sugestão vira pergunta): o foco vai para o campo, dentro do painel.
  const focusComposer = () => requestAnimationFrame(() => composer.current?.focus())
  const ask = (question: string) => {
    chat.send(question)
    focusComposer()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Faisca label={null} className="size-4" />
          <span>
            Assistente <Marca />
          </span>
        </span>
      }
      actions={
        hasConversation && (
          <Button
            variant="ghost"
            size="sm"
            icon={<SquarePen aria-hidden className="size-4" />}
            onClick={() => {
              chat.reset()
              focusComposer()
            }}
            className="max-sm:h-11 max-sm:px-2.5"
          >
            <span className="max-sm:sr-only">Nova conversa</span>
          </Button>
        )
      }
      footer={<Composer inputRef={composer} />}
    >
      {hasConversation ? (
        <Thread
          onAsk={ask}
          onRetry={() => {
            chat.retry()
            focusComposer()
          }}
        />
      ) : (
        <EmptyState onAsk={ask} />
      )}
    </Sheet>
  )
}

function EmptyState({ onAsk }: { onAsk: (question: string) => void }) {
  const { rota } = useAssistantContext()
  const { nome, perguntas } = screenContext(rota)
  return (
    <div>
      <p className="max-w-[44ch] text-sm leading-relaxed text-ink-muted">
        Pergunte sobre caixa, vendas, recebíveis, contas, estoque e crédito. A <Marca /> responde
        com os números da sua empresa e mostra onde agir.
      </p>
      <h3 className="mt-6 mb-1 text-xs font-medium text-ink-faint">Sugestões para {nome}</h3>
      <ul className="divide-y divide-line border-y border-line">
        {perguntas.map((pergunta) => (
          <li key={pergunta}>
            <button
              type="button"
              onClick={() => onAsk(pergunta)}
              className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-control px-2 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-sunken max-sm:min-h-11"
            >
              <span>{pergunta}</span>
              <ArrowRight
                aria-hidden
                className="size-4 shrink-0 text-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Thread({ onAsk, onRetry }: { onAsk: (question: string) => void; onRetry: () => void }) {
  const { chat } = useAssistantContext()
  const reduce = useReducedMotion()
  const turns = toTurns(chat.entries)
  const latest = useRef<HTMLElement>(null)

  // Leva a última pergunta ao topo, para a resposta ser lida do começo.
  useEffect(() => {
    latest.current?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [chat.entries.length, chat.pendingQuestion, reduce])

  const lastIndex = chat.pendingQuestion === null ? turns.length - 1 : -1
  return (
    <div role="log" aria-live="polite" aria-label="Conversa com o assistente" className="space-y-6">
      {turns.map((turn, index) => (
        <TurnView
          key={turn.question.id}
          ref={index === turns.length - 1 && chat.pendingQuestion === null ? latest : undefined}
          question={turn.question.content}
        >
          {turn.answer && (
            <Answer
              entry={turn.answer}
              fresh={turn.answer.id === chat.freshId}
              last={index === lastIndex}
              onAsk={onAsk}
            />
          )}
        </TurnView>
      ))}
      {chat.pendingQuestion !== null && (
        <TurnView ref={latest} question={chat.pendingQuestion}>
          {chat.pending ? (
            <Thinking />
          ) : (
            chat.failure && <FailureNotice failure={chat.failure} onRetry={onRetry} />
          )}
        </TurnView>
      )}
    </div>
  )
}

function TurnView({
  question,
  children,
  ref,
}: {
  question: string
  children: ReactNode
  ref?: RefObject<HTMLElement | null>
}) {
  return (
    <article ref={ref} className="scroll-mt-2 border-t border-line pt-5 first:border-0 first:pt-0">
      <h3 className="text-[0.9375rem] leading-snug font-semibold break-words whitespace-pre-wrap text-ink">
        <span className="sr-only">Você perguntou: </span>
        {question}
      </h3>
      {children}
    </article>
  )
}

function Answer({
  entry,
  fresh,
  last,
  onAsk,
}: {
  entry: Extract<ChatEntry, { role: 'assistant' }>
  fresh: boolean
  last: boolean
  onAsk: (question: string) => void
}) {
  const { close } = useAssistantContext()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const acoes = entry.acoes.filter((acao) => isPortalRoute(acao.rota))
  return (
    <motion.div
      className="mt-3"
      initial={fresh && !reduce ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Faisca label={null} className="size-3" />
        <span>
          <span className="sr-only">Resposta da </span>
          <Marca />
        </span>
      </p>
      <Markdown source={entry.content} />

      {entry.fontes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
          <DrawnCheck fresh={fresh} />
          <span>Baseado em:</span>
          {entry.fontes.map((fonte) => (
            <span
              key={`${fonte.tipo}-${fonte.label}`}
              className="rounded-full bg-sunken px-2 py-0.5 text-ink-muted"
            >
              {fonte.label}
            </span>
          ))}
        </div>
      )}

      {acoes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {acoes.map((acao) => (
            <Button
              key={acao.rota + acao.label}
              variant="secondary"
              size="sm"
              className="max-sm:h-11"
              onClick={() => {
                navigate(acao.rota)
                close()
              }}
            >
              {acao.label}
              <ArrowRight aria-hidden className="size-3.5 text-ink-muted" />
            </Button>
          ))}
        </div>
      )}

      {last && entry.sugestoes.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-ink-faint">Continue com</p>
          <ul className="flex flex-wrap gap-2">
            {entry.sugestoes.map((sugestao) => (
              <li key={sugestao}>
                <button type="button" className={chip} onClick={() => onAsk(sugestao)}>
                  {sugestao}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

/** Check desenhado quando a resposta chega (o mesmo do hero); parado no histórico. */
function DrawnCheck({ fresh }: { fresh: boolean }) {
  const reduce = useReducedMotion()
  const draw = fresh && !reduce
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-testid="fontes-check"
    >
      <motion.path
        d="M3.25 8.4 6.4 11.5l6.35-7"
        className="stroke-accent"
        initial={draw ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.12 }}
      />
    </svg>
  )
}

/** "Pensando": linha fina indeterminada e um status calmo que acompanha a tela. */
function Thinking() {
  const { rota } = useAssistantContext()
  const reduce = useReducedMotion()
  const [steps] = useState(() => thinkingStatus(rota))
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, steps.length - 1)),
      2400,
    )
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div className="mt-4 space-y-2.5" data-testid="assistant-thinking">
      <div className="relative h-px w-full overflow-hidden bg-line-strong">
        {reduce ? (
          <div className="absolute inset-y-0 left-0 w-1/3 bg-ink-muted" />
        ) : (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 bg-ink-muted"
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </div>
      <div className="grid text-sm text-ink-muted">
        <AnimatePresence initial={false}>
          <motion.p
            key={steps[step]}
            className="col-start-1 row-start-1"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            {steps[step]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

function FailureNotice({ failure, onRetry }: { failure: AssistantFailure; onRetry: () => void }) {
  const { close, chat } = useAssistantContext()
  const wait = useSecondsLeft(chat.blockedUntil)
  let message: string
  let action: ReactNode = (
    <Button
      variant="secondary"
      size="sm"
      className="mt-2.5 max-sm:h-11"
      onClick={onRetry}
      disabled={wait > 0}
    >
      Tentar de novo
    </Button>
  )
  switch (failure.kind) {
    case 'indisponivel':
      message = 'O assistente está indisponível no momento. Tente de novo em alguns minutos.'
      break
    case 'limite':
      message = `Você atingiu o limite de 10 perguntas por minuto. Tente de novo em ${
        wait > 0 ? `${wait} s` : 'instantes'
      }.`
      break
    case 'onboarding':
      message = 'O assistente fica disponível depois que o cadastro da empresa for aprovado.'
      action = (
        <Link
          to="/app/status"
          onClick={close}
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline max-sm:min-h-11"
        >
          Ver o status do cadastro
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      )
      break
    default:
      message = failure.message
  }
  return (
    <div role="alert" className="mt-4 flex gap-2.5 rounded-control bg-sunken px-3.5 py-3">
      <AlertCircle
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          failure.kind === 'falha' || failure.kind === 'indisponivel'
            ? 'text-negative'
            : 'text-warning',
        )}
      />
      <div className="text-sm text-ink">
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}

function Composer({ inputRef }: { inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const { chat, draft: text, setDraft: setText } = useAssistantContext()
  const id = useId()

  // Pergunta pré-preenchida (ex. "Perguntar à ErpIa sobre isso"): cursor no fim do texto.
  useEffect(() => {
    const input = inputRef.current
    if (input?.value) input.setSelectionRange(input.value.length, input.value.length)
  }, [inputRef])
  const near = text.length >= COUNTER_FROM
  const blocked = useSecondsLeft(chat.blockedUntil) > 0
  const canSend = text.trim().length > 0 && !chat.pending && !blocked

  const submit = () => {
    if (!canSend) return
    chat.send(text)
    setText('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <form
      className="w-full space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Sua pergunta para a ErpIa
      </label>
      <div className="flex items-end gap-2 rounded-control border border-line-strong bg-surface py-1.5 pr-1.5 pl-3 transition-colors duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_1px_var(--erpia-accent)]">
        <textarea
          ref={inputRef}
          id={id}
          data-autofocus
          rows={1}
          maxLength={MAX_CHARS}
          value={text}
          readOnly={chat.pending}
          aria-describedby={`${id}-hint${near ? ` ${id}-count` : ''}`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pergunte sobre a sua empresa"
          className="[field-sizing:content] max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1 text-[0.9375rem] leading-6 text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar pergunta"
          disabled={!canSend}
          className="grid size-8 shrink-0 place-items-center rounded-control bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint max-sm:size-11"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Enter envia; Shift + Enter quebra a linha.
      </p>
      <div className="flex items-start justify-between gap-3 text-2xs text-ink-faint">
        <p>{DISCLAIMER}</p>
        {near && (
          <p
            id={`${id}-count`}
            className={cn('tabular shrink-0', text.length >= MAX_CHARS && 'text-negative')}
          >
            {number(text.length)}/{number(MAX_CHARS)}
          </p>
        )}
      </div>
    </form>
  )
}
