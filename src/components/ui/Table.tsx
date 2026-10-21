import type { ReactNode } from 'react'

/** Tabela simples com rolagem horizontal em telas pequenas. */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&_td]:px-3 [&_td]:py-2">{children}</tbody>
      </table>
    </div>
  )
}
