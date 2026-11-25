# Pedidos Volta às Aulas 2027 · Papel & Magia

App de pedidos da papelaria Papel & Magia (Rua Tabor, 456). Usado pelo Manoel e pela Paola, no computador e no celular.

## Como funciona

- **Site**: GitHub Pages, a partir da pasta raiz deste repositório.
- **Dados e login**: Supabase (projeto `papel-e-magia-pedidos`, servidor em São Paulo).
  Só os e-mails da tabela `equipe` conseguem criar senha e ver os pedidos.
- **Instalar no celular**: abrir o endereço do app no navegador e escolher
  "Adicionar à tela de início" (iPhone: botão Compartilhar no Safari; Android: menu ⋮ no Chrome).

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | O app (mesmas telas e funções da versão 1.0) |
| `nuvem.js` | Login e ligação com o banco de dados do Supabase |
| `config.js` | Endereço do Supabase e chave pública |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalação no celular e ícone com o logo |
| `vendor/` | Biblioteca do Supabase (supabase-js 2.45.4) |
| `supabase/migrations/` | Estrutura do banco de dados |

A chave em `config.js` é a chave pública do Supabase, feita para ficar no navegador.
Quem protege os dados são as regras do banco (RLS): sem login de alguém da equipe, nada é entregue.
