// Mensagens que o atendimento automático envia ao cliente, independentes do canal
// (WhatsApp ou simulador do painel). Os limites seguem as mensagens interativas
// da WhatsApp Cloud API.

export const LIMITES = {
  corpo: 1024,
  botoes: 3,
  tituloBotao: 20,
  linhasLista: 10,
  tituloLinha: 24,
  descricaoLinha: 72,
  botaoLista: 20,
}

export interface Opcao {
  id: string
  titulo: string
  descricao?: string
}

export type MensagemSaida =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'botoes'; texto: string; botoes: Opcao[] }
  | { tipo: 'lista'; texto: string; botao: string; opcoes: Opcao[] }

const cortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s)

export function texto(texto: string): MensagemSaida {
  return { tipo: 'texto', texto }
}

export function botoes(texto: string, opcoes: Opcao[]): MensagemSaida {
  return {
    tipo: 'botoes',
    texto: cortar(texto, LIMITES.corpo),
    botoes: opcoes.slice(0, LIMITES.botoes).map((o) => ({ id: o.id, titulo: cortar(o.titulo, LIMITES.tituloBotao) })),
  }
}

export function lista(texto: string, botao: string, opcoes: Opcao[]): MensagemSaida {
  return {
    tipo: 'lista',
    texto: cortar(texto, LIMITES.corpo),
    botao: cortar(botao, LIMITES.botaoLista),
    opcoes: opcoes.slice(0, LIMITES.linhasLista).map((o) => ({
      id: o.id,
      titulo: cortar(o.titulo, LIMITES.tituloLinha),
      descricao: o.descricao ? cortar(o.descricao, LIMITES.descricaoLinha) : undefined,
    })),
  }
}

/** Versão em texto corrido, usada na transcrição que a equipe vê no painel. */
export function paraTranscricao(msg: MensagemSaida) {
  if (msg.tipo === 'texto') return msg.texto
  const opcoes = msg.tipo === 'botoes' ? msg.botoes : msg.opcoes
  return `${msg.texto}\n[${opcoes.map((o) => o.titulo).join(' | ')}]`
}
