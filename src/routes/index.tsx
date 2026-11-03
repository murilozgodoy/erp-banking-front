import { createBrowserRouter, Navigate } from 'react-router'

import { Auth0ProviderWithNavigate } from '@/components/auth/Auth0ProviderWithNavigate'
import { BackofficeOnly } from '@/components/auth/BackofficeOnly'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { MainLayout } from '@/components/layout/MainLayout'
import { AccountDetailPage } from '@/pages/accounts/AccountDetailPage'
import { AccountsPage } from '@/pages/accounts/AccountsPage'
import { AnalisesPage } from '@/pages/analises/AnalisesPage'
import { InvitePage } from '@/pages/convite/InvitePage'
import { CreditsPage } from '@/pages/credits/CreditsPage'
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage'
import { CustomersPage } from '@/pages/customers/CustomersPage'
import { NewCustomerPage } from '@/pages/customers/NewCustomerPage'
import { LandingGate } from '@/pages/landing/LandingGate'
import { LoginPage } from '@/pages/LoginPage'
import { MonitoringPage } from '@/pages/MonitoringPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { FocusLayout } from '@/portal/layout/FocusLayout'
import { PortalGate } from '@/portal/layout/PortalGate'
import { PortalLayout } from '@/portal/layout/PortalLayout'
import { CreditPage } from '@/portal/pages/credito/CreditPage'
import { TeamPage } from '@/portal/pages/equipe/TeamPage'
import { PortalProfilePage } from '@/portal/pages/perfil/PortalProfilePage'
import { InventoryPage } from '@/portal/pages/estoque/InventoryPage'
import { OnboardingPage } from '@/portal/pages/onboarding/OnboardingPage'
import { OverviewPage } from '@/portal/pages/overview/OverviewPage'
import { PaymentsPage } from '@/portal/pages/pagamentos/PaymentsPage'
import { PendenciasPage } from '@/portal/pages/pendencias/PendenciasPage'
import { ReceivablesPage } from '@/portal/pages/recebiveis/ReceivablesPage'
import { StatusPage } from '@/portal/pages/status/StatusPage'
import { SalesPage } from '@/portal/pages/vendas/SalesPage'

export const router = createBrowserRouter([
  {
    element: <Auth0ProviderWithNavigate />,
    children: [
      // "/": landing para visitantes; equipe vê o início do backoffice; empresa cliente vai ao portal.
      { index: true, element: <LandingGate /> },
      {
        element: <MainLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          {
            element: <RequireAuth />,
            children: [
              {
                // Empresa cliente não usa o backoffice: vai para o portal.
                element: <BackofficeOnly />,
                children: [
                  { path: 'clientes', element: <CustomersPage /> },
                  { path: 'clientes/novo', element: <NewCustomerPage /> },
                  { path: 'clientes/:id', element: <CustomerDetailPage /> },
                  { path: 'contas', element: <AccountsPage /> },
                  { path: 'contas/:id', element: <AccountDetailPage /> },
                  { path: 'creditos', element: <CreditsPage /> },
                  { path: 'analises', element: <AnalisesPage /> },
                  { path: 'perfil', element: <ProfilePage /> },
                  { path: 'monitoramento', element: <MonitoringPage /> },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // Convite de equipe: público; a própria página leva ao login/cadastro e aceita depois.
      { path: 'convite/:token', element: <InvitePage /> },
      {
        path: 'app',
        element: <RequireAuth />,
        children: [
          {
            element: <PortalGate />,
            children: [
              {
                element: <FocusLayout />,
                children: [
                  { path: 'onboarding', element: <OnboardingPage /> },
                  { path: 'status', element: <StatusPage /> },
                ],
              },
              {
                element: <PortalLayout />,
                children: [
                  { index: true, element: <OverviewPage /> },
                  { path: 'vendas', element: <SalesPage /> },
                  { path: 'recebiveis', element: <ReceivablesPage /> },
                  { path: 'pagamentos', element: <PaymentsPage /> },
                  { path: 'pendencias', element: <PendenciasPage /> },
                  { path: 'estoque', element: <InventoryPage /> },
                  { path: 'credito', element: <CreditPage /> },
                  { path: 'equipe', element: <TeamPage /> },
                  { path: 'perfil', element: <PortalProfilePage /> },
                  { path: '*', element: <Navigate to="/app" replace /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
