export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/estoque/:path*',
    '/fornecedores/:path*',
    '/categorias/:path*',
  ],
}
