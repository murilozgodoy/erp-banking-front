/** Geometria da marca ErpIa, compartilhada entre o símbolo estático e as versões animadas. */

/** Path da Faísca (estrela de 4 pontas do símbolo), no viewBox 32×32 do símbolo. */
export const FAISCA_PATH =
  'M21.6 11.6c.5 2.6 1.4 3.6 4 4.1-2.6.5-3.5 1.5-4 4.1-.5-2.6-1.4-3.6-4-4.1 2.6-.5 3.5-1.5 4-4.1z'

/** Centro da Faísca no viewBox 32×32 (origem para girar ou escalar a estrela). */
export const FAISCA_CENTER = { x: 21.6, y: 15.7 } as const

/** As três linhas de razão contábil que formam o "E" do símbolo. */
export const MARK_LINES = [
  { y: 8.75, width: 13 },
  { y: 14.5, width: 7.5 },
  { y: 20.25, width: 13 },
] as const

/** Grafite do quadrado do símbolo (claro) e a variante mais clara para fundos escuros. */
export const MARK_FILL = { light: '#0C110E', dark: '#1A221D' } as const

/**
 * "I" maiúsculo com serifas (slab), na altura de caixa da Instrument Sans (0,72 em). Na fonte da
 * página o I é uma haste só e "ErpIa" lê como "Erpla"; as serifas tiram a ambiguidade.
 * viewBox 0 0 38 72: haste de 13 (a espessura da Instrument Sans 600) e serifas de 11.
 */
export const SERIF_I_PATH = 'M0 0H38V11H25.5V61H38V72H0V61H12.5V11H0Z'
