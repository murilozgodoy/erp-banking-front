import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" className="text-indigo-700 hover:underline">
        Voltar ao início
      </Link>
    </section>
  )
}
