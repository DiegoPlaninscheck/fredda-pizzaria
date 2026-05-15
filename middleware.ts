export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/producao/:path*',
    '/receitas/:path*',
    '/estoque/:path*',
    '/fornecedores/:path*',
    '/categorias/:path*',
  ],
}
