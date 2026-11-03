import { container, lead, sectionTitle } from './styles'

const PILLARS = [
  {
    titulo: 'Login pelo Auth0',
    texto:
      'Autenticação com OAuth 2.0 e PKCE, feita pelo Auth0. A ErpIa não recebe nem guarda a sua senha.',
  },
  {
    titulo: 'Dados separados por empresa',
    texto:
      'Cada consulta é filtrada pela empresa da sessão, na API e não só na tela. Outra conta não enxerga seus números.',
  },
  {
    titulo: 'LGPD',
    texto:
      'Seus dados servem para operar o ERP e analisar crédito, com finalidade declarada. Você pode pedir cópia ou exclusão quando quiser.',
  },
]

export function TrustSection() {
  return (
    <section id="seguranca" aria-labelledby="seguranca-title" className="py-20 sm:py-28">
      <div className={container}>
        <div className="grid gap-6 lg:grid-cols-12">
          <h2 id="seguranca-title" className={`${sectionTitle} lg:col-span-6`}>
            Seus números continuam sendo da sua empresa.
          </h2>
          <p className={`${lead} max-w-[56ch] lg:col-span-5 lg:col-start-8 lg:pt-2`}>
            A análise de crédito combina regras e IA. Quando um caso foge do padrão, uma pessoa da
            equipe revisa antes de qualquer decisão, e você acompanha o andamento no portal.
          </p>
        </div>
        <dl className="mt-12 grid gap-x-10 sm:mt-16 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.titulo} className="border-t border-ink py-6">
              <dt className="text-lg font-medium text-ink">{p.titulo}</dt>
              <dd className="mt-2 text-ink-muted">{p.texto}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
