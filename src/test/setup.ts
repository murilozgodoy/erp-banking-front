import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import axios from 'axios'
import { afterEach, vi } from 'vitest'

// jsdom aplica CORS ao XHR; com o adapter fetch (Node) os testes falam com o MSW como o navegador
// real fala com o gateway (mesma origem).
axios.defaults.adapter = 'fetch'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
