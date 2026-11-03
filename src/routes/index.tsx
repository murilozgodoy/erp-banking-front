import { createBrowserRouter } from 'react-router'

import { Auth0ProviderWithNavigate } from '@/components/auth/Auth0ProviderWithNavigate'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { MainLayout } from '@/components/layout/MainLayout'
import { AccountDetailPage } from '@/pages/accounts/AccountDetailPage'
import { AccountsPage } from '@/pages/accounts/AccountsPage'
import { CreditsPage } from '@/pages/credits/CreditsPage'
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage'
import { CustomersPage } from '@/pages/customers/CustomersPage'
import { NewCustomerPage } from '@/pages/customers/NewCustomerPage'
import { LandingGate } from '@/pages/landing/LandingGate'
import { LoginPage } from '@/pages/LoginPage'
import { MonitoringPage } from '@/pages/MonitoringPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'

export const router = createBrowserRouter([
  {
    element: <Auth0ProviderWithNavigate />,
    children: [
      // "/": landing para visitantes, início de sempre para quem está logado.
      { index: true, element: <LandingGate /> },
      {
        element: <MainLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          {
            element: <RequireAuth />,
            children: [
              { path: 'clientes', element: <CustomersPage /> },
              { path: 'clientes/novo', element: <NewCustomerPage /> },
              { path: 'clientes/:id', element: <CustomerDetailPage /> },
              { path: 'contas', element: <AccountsPage /> },
              { path: 'contas/:id', element: <AccountDetailPage /> },
              { path: 'creditos', element: <CreditsPage /> },
              { path: 'perfil', element: <ProfilePage /> },
              { path: 'monitoramento', element: <MonitoringPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
