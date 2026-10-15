// Dicionário pt-BR — idioma inicial e fonte da verdade das chaves.
// Toda chave nova entra aqui primeiro; o inglês é obrigado a cobri-la
// (o tipo `Traducoes` em en.ts garante isso em tempo de compilação).

export const ptBR = {
  // Aplicação / cabeçalho
  'app.nome': 'Double Dash Masters',
  'app.descricao': 'Estatísticas das lives de Mario Kart: Double Dash!!',
  'app.marca.titulo': 'Double Dash Masters',
  'app.marca.subtitulo': 'Painel de estatísticas',

  // Navegação
  'nav.inicio': 'Início',
  'nav.jogadores': 'Jogadores',
  'nav.campeonato': 'Campeonato',
  'nav.lives': 'Lives',
  'nav.itens': 'Itens',
  'nav.estatisticas': 'Estatísticas',
  'nav.abrirMenu': 'Abrir menu',
  'nav.fecharMenu': 'Fechar menu',
  'nav.principal': 'Navegação principal',

  // Comuns
  'comum.carregando': 'Carregando…',
  'comum.atualizando': 'Atualizando…',
  'comum.erro': 'Não foi possível carregar os dados',
  'comum.tentarNovamente': 'Tentar novamente',
  'comum.semDados': 'Sem dados',
  'comum.atualizadoEm': 'Atualizado em',
  'comum.nunca': '—',
  'comum.nome': 'Nome',
  'comum.jogador': 'Jogador',
  'comum.jogadores': 'Jogadores',
  'comum.temporada': 'Temporada',
  'comum.vitorias': 'Vitórias',
  'comum.pontos': 'Pontos',
  'comum.total': 'Total',
  'comum.posicao': 'Posição',
  'comum.data': 'Data',
  'comum.detalhes': 'Detalhes',
  'comum.verDetalhes': 'Ver detalhes',
  'comum.voltar': 'Voltar',
  'comum.todos': 'Todos',
  'comum.todas': 'Todas',
  'comum.buscar': 'Buscar',
  'comum.ordenarPor': 'Ordenar por',
  'comum.indisponivel': 'Indisponível',
  'comum.naoInformado': 'Não informado',
  'comum.resultados': 'resultados',
  'comum.filtros': 'Filtros',
  'comum.limparFiltros': 'Limpar filtros',
  'comum.idioma': 'Idioma',
  'comum.portugues': 'Português',
  'comum.ingles': 'Inglês',
  'comum.abrirTransmissao': 'Abrir transmissão',

  // Estados de erro (por código)
  'erro.rede': 'Falha de rede. Verifique sua conexão e tente novamente.',
  'erro.timeout': 'A API demorou demais para responder. Tente novamente.',
  'erro.http': 'A API respondeu com um erro.',
  'erro.resposta': 'A API devolveu uma resposta inesperada.',

  // Estado vazio genérico
  'vazio.titulo': 'Ainda não há dados registrados',
  'vazio.texto':
    'As estatísticas oficiais aparecerão aqui assim que o MKDDTracker desktop enviar as primeiras lives.',

  // Início (Dashboard)
  'inicio.titulo': 'Visão geral',
  'inicio.subtitulo': 'Resumo do campeonato a partir das lives finalizadas',
  'inicio.kpi.jogadores': 'Jogadores',
  'inicio.kpi.jogadores.dica': 'Jogadores distintos em lives finalizadas (vw_geral.jogadores).',
  'inicio.kpi.livesFinalizadas': 'Lives finalizadas',
  'inicio.kpi.livesFinalizadas.dica': 'Lives com status finalizada (vw_geral.lives_finalizadas).',
  'inicio.kpi.vitorias': 'Vitórias',
  'inicio.kpi.vitorias.dica': 'Total de vitórias somando o recurso campeonato (vw_campeonato).',
  'inicio.kpi.itens': 'Itens registrados',
  'inicio.kpi.itens.dica': 'Total de itens somados (vw_geral.itens_totais).',
  'inicio.kpi.relampagos': 'Relâmpagos',
  'inicio.kpi.relampagos.dica': 'Itens classificados como relâmpago (vw_geral.relampagos).',
  'inicio.kpi.cascosAzuis': 'Cascos azuis',
  'inicio.kpi.cascosAzuis.dica': 'Itens classificados como casco azul (vw_geral.cascos_azuis).',
  'inicio.kpi.emAndamento': 'Lives em andamento',
  'inicio.kpi.emAndamento.dica': 'Lives com status ativa (vw_geral.lives_em_andamento).',
  'inicio.grafico.vitorias.titulo': 'Vitórias por jogador',
  'inicio.grafico.vitorias.descricao': 'Baseado no recurso campeonato (vw_campeonato.vitorias).',
  'inicio.ranking.titulo': 'Ranking por vitórias',
  'inicio.ranking.descricao': 'Jogadores ordenados por vitórias no campeonato.',
  'inicio.itens.titulo': 'Itens em destaque',
  'inicio.itens.descricao': 'Relâmpagos e cascos azuis por jogador.',
  'inicio.atalhos.titulo': 'Explorar',
  'inicio.atalhos.campeonato': 'Ver o campeonato completo',
  'inicio.atalhos.jogadores': 'Ver todos os jogadores',
  'inicio.atalhos.lives': 'Ver histórico de lives',
  'inicio.atalhos.itens': 'Ver estatísticas de itens',

  // Jogadores
  'jogadores.titulo': 'Jogadores',
  'jogadores.subtitulo': 'Pontuação acumulada nas lives finalizadas',
  'jogadores.busca.rotulo': 'Buscar jogador',
  'jogadores.busca.placeholder': 'Digite um nome…',
  'jogadores.busca.semResultado': 'Nenhum jogador corresponde à busca.',
  'jogadores.col.nome': 'Jogador',
  'jogadores.col.pontos': 'Pontos totais',
  'jogadores.col.lives': 'Lives',
  'jogadores.col.melhorLive': 'Melhor live',
  'jogadores.ordenar.pontos': 'Mais pontos',
  'jogadores.ordenar.vitorias': 'Nome (A–Z)',
  'jogadores.ordenar.lives': 'Mais lives',
  'jogadores.vazio.titulo': 'Nenhum jogador registrado',
  'jogadores.vazio.texto':
    'Os jogadores aparecem aqui quando há lives finalizadas com pontuação.',

  // Perfil de jogador
  'jogador.titulo': 'Perfil do jogador',
  'jogador.kpi.pontos': 'Pontos totais',
  'jogador.kpi.lives': 'Lives participadas',
  'jogador.kpi.melhorLive': 'Melhor live',
  'jogador.naoEncontrado.titulo': 'Jogador não encontrado',
  'jogador.naoEncontrado.texto': 'Nenhum registro corresponde a este identificador.',
  'jogador.limitacao':
    'A API pública expõe apenas pontos totais, lives e melhor live por jogador. Pódios, tempos e itens individuais não estão disponíveis neste recurso.',

  // Campeonato
  'campeonato.titulo': 'Campeonato Anual',
  'campeonato.subtitulo': 'Classificação por temporada, com pontos e vitórias',
  'campeonato.seletor.rotulo': 'Temporada',
  'campeonato.seletor.todas': 'Todas as temporadas',
  'campeonato.col.posicao': 'Pos.',
  'campeonato.col.jogador': 'Jogador',
  'campeonato.col.pontos': 'Pontos',
  'campeonato.col.vitorias': 'Vitórias',
  'campeonato.lider': 'Líder',
  'campeonato.regra.titulo': 'Como a classificação é calculada',
  'campeonato.regra.texto':
    'Cada live finalizada vale 1 vitória para quem fez mais pontos nela (desempate do servidor pelo menor player_id). O ranking ordena por pontos da temporada (quando disponíveis), depois por vitórias e, por fim, pelo nome em ordem alfabética; empates mantêm a mesma posição.',
  'campeonato.limitacao.pontos.titulo': 'Pontos por temporada indisponíveis',
  'campeonato.limitacao.pontos.texto':
    'A API pública expõe apenas o total de pontos do jogador somando todas as lives finalizadas (jogadores.pontos_totais_live), sem separar por temporada. Com mais de uma temporada no conjunto de dados, esses pontos não podem ser atribuídos a uma temporada específica e não são inventados — as vitórias seguem por temporada.',
  'campeonato.vazio.titulo': 'Nenhuma live registrada nesta seleção',
  'campeonato.vazio.texto': 'A classificação aparece quando houver lives finalizadas.',

  // Lives
  'lives.titulo': 'Lives',
  'lives.subtitulo': 'Histórico de transmissões finalizadas',
  'lives.col.live': 'Live',
  'lives.col.data': 'Data',
  'lives.col.temporada': 'Temporada',
  'lives.col.vencedor': 'Vencedor',
  'lives.col.pontosVencedor': 'Pontos do vencedor',
  'lives.col.transmissao': 'Transmissão',
  'lives.filtro.temporada': 'Temporada',
  'lives.filtro.vencedor': 'Vencedor',
  'lives.ordem.rotulo': 'Ordenar',
  'lives.ordem.recentes': 'Mais recentes',
  'lives.ordem.antigas': 'Mais antigas',
  'lives.assistir': 'Assistir',
  'lives.semLink': 'Sem link',
  'lives.vazio.titulo': 'Nenhuma live registrada',
  'lives.vazio.texto': 'As transmissões enviadas pelo MKDDTracker desktop aparecerão aqui.',
  'lives.vazio.emAndamento.titulo': 'Nenhuma live finalizada ainda',
  'lives.vazio.emAndamento.uma':
    'Há 1 live em andamento agora. As transmissões finalizadas aparecerão aqui.',
  'lives.vazio.emAndamento.varias':
    'Há {n} lives em andamento agora. As transmissões finalizadas aparecerão aqui.',
  'lives.limitacao':
    'A API pública informa data, temporada e vencedor de cada live. A lista completa de participantes, a pontuação individual e os tempos ainda não são expostos.',

  // Detalhe de live
  'live.detalhe.titulo': 'Detalhe da live',
  'live.col.vencedor': 'Vencedor',
  'live.col.pontosVencedor': 'Pontos do vencedor',
  'live.col.iniciadaEm': 'Início',
  'live.col.finalizadaEm': 'Fim',
  'live.col.temporada': 'Temporada',
  'live.naoEncontrada.titulo': 'Live não encontrada',
  'live.naoEncontrada.texto': 'Nenhuma live corresponde a este identificador.',
  'live.limitacao.titulo': 'Dados não disponíveis nesta versão',
  'live.limitacao.texto':
    'Participantes, placar individual, pódios e tempos por jogador dependem de recursos que a API pública ainda não expõe.',

  // Itens
  'itens.titulo': 'Itens',
  'itens.subtitulo': 'Contagens de itens registradas nas lives finalizadas',
  'itens.col.item': 'Item',
  'itens.col.classe': 'Classe',
  'itens.col.jogador': 'Jogador',
  'itens.col.temporada': 'Temporada',
  'itens.col.total': 'Total',
  'itens.col.aquisicoes': 'Aquisições',
  'itens.filtro.classe': 'Classe',
  'itens.busca.rotulo': 'Buscar item',
  'itens.busca.placeholder': 'Digite o nome do item…',
  'itens.grafico.titulo': 'Distribuição por item',
  'itens.grafico.descricao': 'Soma do campo total por nome de item.',
  'itens.grafico.outros': 'Outros',
  'itens.vazio.titulo': 'Nenhum item registrado',
  'itens.vazio.texto': 'As contagens de itens aparecem quando há lives finalizadas com itens.',
  'itens.classe.todas': 'Todas as classes',
  'itens.classe.relampago': 'Relâmpago',
  'itens.classe.cascoAzul': 'Casco azul',
  'itens.classe.semClasse': 'Sem classe',
  'itens.explicacao.total':
    'Total: quantidade somada do item na live (campo total do recurso itens).',
  'itens.explicacao.aquisicoes':
    'Aquisições: quantas vezes o item foi adquirido (campo aquisicoes do recurso itens).',

  // Estatísticas
  'estatisticas.titulo': 'Estatísticas de itens especiais',
  'estatisticas.subtitulo': 'Relâmpagos e cascos azuis por jogador',
  'estatisticas.relampagos.titulo': 'Relâmpagos',
  'estatisticas.relampagos.descricao':
    'Soma dos itens classificados como relâmpago (recurso relampagos).',
  'estatisticas.cascos.titulo': 'Cascos azuis',
  'estatisticas.cascos.descricao':
    'Soma dos itens classificados como casco azul (recurso cascos_azuis).',
  'estatisticas.grafico.porJogador': 'Por jogador',
  'estatisticas.grafico.descricao': 'Distribuição das contagens por jogador.',
  'estatisticas.total.rotulo': 'Total registrado',
  'estatisticas.col.jogador': 'Jogador',
  'estatisticas.col.total': 'Total',
  'estatisticas.col.aquisicoes': 'Aquisições',
  'estatisticas.limitacao.titulo': 'Itens indisponíveis nesta versão',
  'estatisticas.limitacao.texto':
    'Recordes de tempo e estatísticas que dependem de recursos não expostos pela API não são exibidos aqui.',
  'estatisticas.vazio.titulo': 'Sem dados de itens especiais',
  'estatisticas.vazio.texto':
    'Relâmpagos e cascos azuis aparecem quando há lives finalizadas com esses itens.',

  // Rodapé
  'rodape.nota':
    'Dados públicos e somente-leitura, enviados pelo aplicativo MKDDTracker. Nenhuma informação é editada nesta página.',

  // Página não encontrada
  'naoEncontrado.titulo': 'Página não encontrada',
  'naoEncontrado.texto':
    'O endereço acessado não existe neste painel. Use o menu para navegar.',
  'naoEncontrado.acao': 'Ir para o início',
} as const;

export type ChaveTraducao = keyof typeof ptBR;
