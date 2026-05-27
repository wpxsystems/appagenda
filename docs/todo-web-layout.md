# TODO: Layout Web Responsivo

## Objetivo
Transformar o app (atualmente com PhoneShell/moldura de celular) em um site real,
aproveitando a tela toda no desktop/notebook e mantendo boa experiência no mobile.

## O que mudar

### Navegação
- Desktop: sidebar lateral fixa com ícones + labels (Descobrir, Meus Jogos, Criar, Perfil)
- Mobile: manter bottom bar atual
- Breakpoint sugerido: 768px

### Telas a adaptar
- **Descobrir**: grid de cards (2-3 colunas no desktop), sidebar de filtros à esquerda
- **Meus Jogos**: lista mais larga, possível split-view (lista + detalhe lado a lado)
- **Criar jogo**: formulário centralizado estilo web, max-width ~600px
- **Perfil**: layout de página de perfil, seções em colunas no desktop
- **Detalhe do jogo**: painel lateral ou modal full no desktop

### Componentes a criar/alterar
- Remover `PhoneShell` e `PageWrapper` das páginas (ou torná-los opcionais)
- Criar `AppShell` responsivo com sidebar no desktop e bottom bar no mobile
- Adaptar `GameCard`, `GameDetailView` para largura total

## Estimativa
~1 dia de trabalho de frontend

## Status
⏸️ Standby — retomar quando decidir evoluir para web completo
