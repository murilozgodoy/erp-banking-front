import { createBrowserRouter } from 'react-router'

import { Auth0ProviderWithNavigate } from '@/components/auth/Auth0ProviderWithNavigate'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { MainLayout } from '@/components/layout/MainLayout'
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage'
import { CustomersPage } from '@/pages/customers/CustomersPage'
import { NewCustomerPage } from '@/pages/customers/NewCustomerPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'

export const router = createBrowserRouter([
  {
    element: <Auth0ProviderWithNavigate />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          {
            element: <RequireAuth />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'clientes', element: <CustomersPage /> },
              { path: 'clientes/novo', element: <NewCustomerPage /> },
              { path: 'clientes/:id', element: <CustomerDetailPage /> },
              { path: 'perfil', element: <ProfilePage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
