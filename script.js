(function () {
  'use strict';

  // ---------- Armazenamento seguro (funciona mesmo se localStorage estiver bloqueado) ----------
  const memoriaFallback = {};
  let armazenamentoDisponivel = true;
  function lsGet(chave) {
    try { return localStorage.getItem(chave); }
    catch (e) { armazenamentoDisponivel = false; return Object.prototype.hasOwnProperty.call(memoriaFallback, chave) ? memoriaFallback[chave] : null; }
  }
  function lsSet(chave, valor) {
    try { localStorage.setItem(chave, valor); }
    catch (e) { armazenamentoDisponivel = false; memoriaFallback[chave] = String(valor); }
  }
  function carregarLista(chave, padrao) {
    try {
      const bruto = lsGet(chave);
      const valor = bruto ? JSON.parse(bruto) : null;
      return valor || padrao;
    } catch { return padrao; }
  }
  function salvarLista(chave, lista) { lsSet(chave, JSON.stringify(lista)); }

  const canvas = document.getElementById('tela');
  const ctx = canvas.getContext('2d');
  const tamanhoBloco = 20;
  const colunas = canvas.width / tamanhoBloco;
  const linhas = canvas.height / tamanhoBloco;

  const elPontos = document.getElementById('pontos');
  const elRecorde = document.getElementById('recorde');
  const elMoedas = document.getElementById('moedas');
  const elMoedasLoja = document.getElementById('moedasLoja');
  const elNivel = document.getElementById('nivel');
  const overlay = document.getElementById('overlay');
  const overlayLoja = document.getElementById('overlayLoja');
  const overlayConquistas = document.getElementById('overlayConquistas');
  const overlayRanking = document.getElementById('overlayRanking');
  const mensagem = document.getElementById('mensagem');
  const pontosFinal = document.getElementById('pontosFinal');
  const moedasFinal = document.getElementById('moedasFinal');
  const gradeSkins = document.getElementById('gradeSkins');
  const listaConquistas = document.getElementById('listaConquistas');
  const listaRanking = document.getElementById('listaRanking');
  const btnParede = document.getElementById('btnParede');
  const btnSom = document.getElementById('btnSom');
  const toastContainer = document.getElementById('toastContainer');

  // cores do tabuleiro lidas uma única vez (evita recalcular em todo quadro/célula)
  const estiloRaiz = getComputedStyle(document.documentElement);
  const corGradeA = (estiloRaiz.getPropertyValue('--grid-a') || '#14203c').trim();
  const corGradeB = (estiloRaiz.getPropertyValue('--grid-b') || '#182548').trim();

  // ---------- Toasts ----------
  function mostrarToast(texto) {
    try {
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = texto;
      toastContainer.appendChild(el);
      requestAnimationFrame(() => el.classList.add('mostrar'));
      setTimeout(() => {
        el.classList.remove('mostrar');
        setTimeout(() => el.remove(), 400);
      }, 3200);
    } catch (e) { /* falha silenciosa - notificação não é essencial */ }
  }

  // ---------- Som ----------
  let audioCtx = null;
  let somLigado = lsGet('cobrinha-som') !== '0';
  function atualizarBotaoSom() { btnSom.textContent = somLigado ? '🔊 Som: Ligado' : '🔇 Som: Desligado'; }
  atualizarBotaoSom();
  btnSom.addEventListener('click', () => {
    somLigado = !somLigado;
    lsSet('cobrinha-som', somLigado ? '1' : '0');
    atualizarBotaoSom();
  });
  function obterAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  function tocarSom(tipo) {
    if (!somLigado) return;
    try {
      const a = obterAudioCtx();
      if (!a) return;
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.connect(gain); gain.connect(a.destination);
      const agora = a.currentTime;
      if (tipo === 'comer') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, agora);
        osc.frequency.exponentialRampToValueAtTime(880, agora + 0.09);
        gain.gain.setValueAtTime(0.18, agora);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.12);
        osc.start(agora); osc.stop(agora + 0.13);
      } else if (tipo === 'colisao') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, agora);
        osc.frequency.exponentialRampToValueAtTime(40, agora + 0.35);
        gain.gain.setValueAtTime(0.22, agora);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.4);
        osc.start(agora); osc.stop(agora + 0.4);
      } else if (tipo === 'compra') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, agora);
        osc.frequency.setValueAtTime(990, agora + 0.08);
        gain.gain.setValueAtTime(0.15, agora);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.22);
        osc.start(agora); osc.stop(agora + 0.22);
      }
    } catch (e) { /* ambiente sem suporte a áudio: ignora, não deve travar o jogo */ }
  }

  // ---------- Skins ----------
  const skins = [
    { id: 'classica',  nome: 'Clássica',   preco: 0,   cor1: '#4ade80', cor2: '#15803d', brilho: 'rgba(74,222,128,0.55)' },
    { id: 'neon',      nome: 'Neon',       preco: 50,  cor1: '#22d3ee', cor2: '#a21caf', brilho: 'rgba(34,211,238,0.7)'  },
    { id: 'fogo',      nome: 'Fogo',       preco: 80,  cor1: '#fde047', cor2: '#b91c1c', brilho: 'rgba(249,115,22,0.7)' },
    { id: 'gelo',      nome: 'Gelo',       preco: 100, cor1: '#f0f9ff', cor2: '#0284c7', brilho: 'rgba(125,211,252,0.7)'},
    { id: 'ouro',      nome: 'Ouro',       preco: 150, cor1: '#fef9c3', cor2: '#a16207', brilho: 'rgba(250,204,21,0.7)' },
    { id: 'arcoiris',  nome: 'Arco-íris',  preco: 200, cor1: 'rainbow', cor2: 'rainbow', brilho: 'rgba(255,255,255,0.7)'}
  ];

  let desbloqueadas = carregarLista('cobrinha-skins-desbloqueadas', ['classica']);
  let skinAtual = lsGet('cobrinha-skin') || 'classica';
  if (!skins.some(s => s.id === skinAtual)) skinAtual = 'classica'; // protege contra dado corrompido
  let moedas = Number(lsGet('cobrinha-moedas')) || 0;
  let semParede = lsGet('cobrinha-sem-parede') === '1';

  function salvarMoedas() {
    lsSet('cobrinha-moedas', moedas);
    elMoedas.textContent = moedas;
    elMoedasLoja.textContent = moedas;
  }

  function atualizarBotaoParede() { btnParede.textContent = semParede ? '🌀 Paredes: Desativadas' : '🧱 Paredes: Ativas'; }
  atualizarBotaoParede();
  btnParede.addEventListener('click', () => {
    semParede = !semParede;
    lsSet('cobrinha-sem-parede', semParede ? '1' : '0');
    atualizarBotaoParede();
  });

  function hexParaRgb(hex) { const v = parseInt(hex.replace('#',''), 16); return { r: (v>>16)&255, g: (v>>8)&255, b: v&255 }; }
  function misturarCor(hexA, hexB, t) {
    const a = hexParaRgb(hexA), b = hexParaRgb(hexB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function corDoSegmento(skin, t, indice, tempo) {
    if (skin.cor1 === 'rainbow') { const matiz = (indice * 22 + tempo / 8) % 360; return `hsl(${matiz}, 85%, 60%)`; }
    return misturarCor(skin.cor1, skin.cor2, t);
  }

  // ---------- Mini cobrinha animada (prévia na loja) ----------
  let miniCanvasList = [];
  let animLojaId = null;
  function desenharMiniCobra(mctx, skin) {
    const w = 70, h = 34;
    mctx.clearRect(0, 0, w, h);
    const tempo = Date.now();
    const segmentos = 6;
    for (let i = segmentos - 1; i >= 0; i--) {
      const t = i / (segmentos - 1);
      const x = 12 + i * 9 + Math.sin(tempo / 320) * 3;
      const y = h / 2 + Math.sin(tempo / 220 - i * 0.7) * 9;
      const raio = 6.5 - i * 0.45;
      mctx.save();
      mctx.shadowColor = skin.brilho; mctx.shadowBlur = 5;
      mctx.fillStyle = corDoSegmento(skin, 1 - t, i, tempo);
      mctx.beginPath(); mctx.arc(x, y, Math.max(raio, 2), 0, Math.PI * 2); mctx.fill();
      mctx.restore();
    }
    const xCab = 12 + Math.sin(tempo / 320) * 3;
    const yCab = h / 2 + Math.sin(tempo / 220) * 9;
    mctx.fillStyle = '#0f172a';
    mctx.beginPath(); mctx.arc(xCab + 2.5, yCab - 2.5, 1.3, 0, Math.PI * 2); mctx.fill();
  }
  function iniciarAnimacaoLoja() {
    if (animLojaId) return;
    function passo() {
      if (!overlayLoja.classList.contains('ativo')) { animLojaId = null; return; }
      miniCanvasList.forEach(item => desenharMiniCobra(item.ctx, item.skin));
      animLojaId = requestAnimationFrame(passo);
    }
    passo();
  }

  function renderizarLoja() {
    elMoedasLoja.textContent = moedas;
    gradeSkins.innerHTML = '';
    miniCanvasList = [];
    skins.forEach(skin => {
      const desbloqueada = desbloqueadas.includes(skin.id);
      const equipada = skinAtual === skin.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (equipada ? ' equipada' : '');

      const amostra = document.createElement('canvas');
      amostra.className = 'skin-amostra';
      amostra.width = 70; amostra.height = 34;
      const mctx = amostra.getContext('2d');
      miniCanvasList.push({ ctx: mctx, skin });

      const nome = document.createElement('div');
      nome.className = 'skin-nome'; nome.textContent = skin.nome;

      const preco = document.createElement('div');
      preco.className = 'skin-preco';
      preco.textContent = skin.preco === 0 ? 'Grátis' : `🪙 ${skin.preco}`;

      const botao = document.createElement('button');
      if (equipada) {
        botao.textContent = '✅ Equipada'; botao.disabled = true;
      } else if (desbloqueada) {
        botao.textContent = 'Equipar';
        botao.onclick = () => { skinAtual = skin.id; lsSet('cobrinha-skin', skinAtual); tocarSom('compra'); renderizarLoja(); };
      } else {
        botao.textContent = `Comprar 🪙 ${skin.preco}`;
        botao.disabled = moedas < skin.preco;
        botao.onclick = () => {
          if (moedas >= skin.preco) {
            moedas -= skin.preco;
            desbloqueadas.push(skin.id);
            salvarLista('cobrinha-skins-desbloqueadas', desbloqueadas);
            salvarMoedas();
            skinAtual = skin.id;
            lsSet('cobrinha-skin', skinAtual);
            tocarSom('compra');
            renderizarLoja();
          }
        };
      }
      card.appendChild(amostra); card.appendChild(nome); card.appendChild(preco); card.appendChild(botao);
      gradeSkins.appendChild(card);
    });
    iniciarAnimacaoLoja();
  }

  document.getElementById('btnLoja').onclick = () => { renderizarLoja(); overlayLoja.classList.add('ativo'); };
  document.getElementById('btnLojaOverlay').onclick = () => { overlay.classList.remove('ativo'); renderizarLoja(); overlayLoja.classList.add('ativo'); };
  document.getElementById('fecharLoja').onclick = () => overlayLoja.classList.remove('ativo');

  // ---------- Conquistas ----------
  const conquistas = [
    { id: 'primeira',          nome: 'Primeira Mordida',   desc: 'Coma sua primeira maçã',        meta: 1,   tipo: 'total',  recompensa: 5  },
    { id: 'dez_macas',         nome: 'Bom Apetite',        desc: 'Coma 10 maçãs no total',         meta: 10,  tipo: 'total',  recompensa: 10 },
    { id: 'cinquenta_macas',   nome: 'Comilona',           desc: 'Coma 50 maçãs no total',         meta: 50,  tipo: 'total',  recompensa: 30 },
    { id: 'cem_macas',         nome: 'Devoradora',         desc: 'Coma 100 maçãs no total',        meta: 100, tipo: 'total',  recompensa: 50 },
    { id: 'cem_pontos',        nome: 'Pontuador',          desc: 'Alcance 100 pontos numa partida',meta: 100, tipo: 'pontos', recompensa: 15 },
    { id: 'duzentos_pontos',   nome: 'Mestre da Cobrinha', desc: 'Alcance 200 pontos numa partida',meta: 200, tipo: 'pontos', recompensa: 40 },
    { id: 'nivel5',            nome: 'Sobrevivente',       desc: 'Alcance o nível 5',              meta: 5,   tipo: 'nivel',  recompensa: 25 },
    { id: 'nivel10',           nome: 'Lenda da Cobrinha',  desc: 'Alcance o nível 10',             meta: 10,  tipo: 'nivel',  recompensa: 60 }
  ];
  let conquistasDesbloqueadas = carregarLista('cobrinha-conquistas', []);
  let totalMacas = Number(lsGet('cobrinha-total-macas')) || 0;

  function verificarConquistas() {
    conquistas.forEach(cq => {
      if (conquistasDesbloqueadas.includes(cq.id)) return;
      let valor = 0;
      if (cq.tipo === 'total') valor = totalMacas;
      else if (cq.tipo === 'pontos') valor = pontos;
      else if (cq.tipo === 'nivel') valor = nivel;
      if (valor >= cq.meta) {
        conquistasDesbloqueadas.push(cq.id);
        salvarLista('cobrinha-conquistas', conquistasDesbloqueadas);
        moedas += cq.recompensa;
        salvarMoedas();
        tocarSom('compra');
        mostrarToast(`🏆 Conquista: ${cq.nome}! +${cq.recompensa} 🪙`);
      }
    });
  }

  function renderizarConquistas() {
    listaConquistas.innerHTML = '';
    conquistas.forEach(cq => {
      const desbloqueada = conquistasDesbloqueadas.includes(cq.id);
      const linha = document.createElement('div');
      linha.className = 'conquista-linha' + (desbloqueada ? ' desbloqueada' : '');

      const icone = document.createElement('div');
      icone.className = 'conquista-icone';
      icone.textContent = desbloqueada ? '🏆' : '🔒';

      const texto = document.createElement('div');
      texto.className = 'conquista-texto';
      const nome = document.createElement('div');
      nome.className = 'conquista-nome'; nome.textContent = cq.nome;
      const desc = document.createElement('div');
      desc.className = 'conquista-desc'; desc.textContent = cq.desc;
      texto.appendChild(nome); texto.appendChild(desc);

      const recompensa = document.createElement('div');
      recompensa.className = 'conquista-recompensa';
      recompensa.textContent = `🪙 ${cq.recompensa}`;

      linha.appendChild(icone); linha.appendChild(texto); linha.appendChild(recompensa);
      listaConquistas.appendChild(linha);
    });
  }

  document.getElementById('btnConquistas').onclick = () => { renderizarConquistas(); overlayConquistas.classList.add('ativo'); };
  document.getElementById('fecharConquistas').onclick = () => overlayConquistas.classList.remove('ativo');

  // ---------- Ranking local ----------
  let ranking = carregarLista('cobrinha-ranking', []);
  function salvarPontuacaoRanking(pontuacao) {
    ranking.push({ pontos: pontuacao, data: new Date().toLocaleDateString('pt-BR') });
    ranking.sort((a, b) => b.pontos - a.pontos);
    ranking = ranking.slice(0, 10);
    salvarLista('cobrinha-ranking', ranking);
  }
  function renderizarRanking() {
    listaRanking.innerHTML = '';
    if (ranking.length === 0) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Nenhuma pontuação registrada ainda. Jogue uma partida!';
      vazio.style.opacity = '0.7';
      listaRanking.appendChild(vazio);
      return;
    }
    ranking.forEach((linhaDados, indice) => {
      const linha = document.createElement('div');
      linha.className = 'ranking-linha';

      const pos = document.createElement('div');
      pos.className = 'ranking-pos';
      pos.textContent = `#${indice + 1}`;

      const info = document.createElement('div');
      info.className = 'ranking-info';
      info.innerHTML = `<div>${linhaDados.pontos} pontos</div><div class="ranking-data">${linhaDados.data}</div>`;

      linha.appendChild(pos); linha.appendChild(info);
      listaRanking.appendChild(linha);
    });
  }
  document.getElementById('btnRanking').onclick = () => { renderizarRanking(); overlayRanking.classList.add('ativo'); };
  document.getElementById('btnRankingOverlay').onclick = () => { overlay.classList.remove('ativo'); renderizarRanking(); overlayRanking.classList.add('ativo'); };
  document.getElementById('fecharRanking').onclick = () => overlayRanking.classList.remove('ativo');

  // ---------- Estado do jogo ----------
  let recorde = Number(lsGet('cobrinha-recorde')) || 0;
  elRecorde.textContent = recorde;

  let cobra = [];
  let direcao = { x: 1, y: 0 };
  let proximaDirecao = { x: 1, y: 0 };
  let comida = { x: 0, y: 0 };
  let pontos = 0;
  let nivel = 1;
  let pausado = false;
  let jogoAtivo = false;
  let idIntervalo = null;
  const velocidadeBase = 150; // ms por passo

  function velocidadeAtual() {
    return Math.max(60, velocidadeBase - (nivel - 1) * 10);
  }

  function posicionarComida() {
    let livre = false;
    let tentativas = 0;
    while (!livre && tentativas < 500) {
      comida = {
        x: Math.floor(Math.random() * colunas),
        y: Math.floor(Math.random() * linhas)
      };
      livre = !cobra.some(seg => seg.x === comida.x && seg.y === comida.y);
      tentativas++;
    }
  }

  function iniciarJogo() {
    const meio = Math.floor(colunas / 2);
    const meioY = Math.floor(linhas / 2);
    cobra = [
      { x: meio - 1, y: meioY },
      { x: meio - 2, y: meioY },
      { x: meio - 3, y: meioY }
    ];
    direcao = { x: 1, y: 0 };
    proximaDirecao = { x: 1, y: 0 };
    pontos = 0;
    nivel = 1;
    pausado = false;
    jogoAtivo = true;
    elPontos.textContent = pontos;
    elNivel.textContent = nivel;
    posicionarComida();
    overlay.classList.remove('ativo');
    reiniciarLoop();
    desenhar();
  }

  function reiniciarLoop() {
    if (idIntervalo) clearInterval(idIntervalo);
    idIntervalo = setInterval(passo, velocidadeAtual());
  }

  function passo() {
    if (!jogoAtivo || pausado) return;
    direcao = proximaDirecao;

    let novaCabeca = { x: cobra[0].x + direcao.x, y: cobra[0].y + direcao.y };

    if (semParede) {
      novaCabeca.x = (novaCabeca.x + colunas) % colunas;
      novaCabeca.y = (novaCabeca.y + linhas) % linhas;
    } else if (novaCabeca.x < 0 || novaCabeca.x >= colunas || novaCabeca.y < 0 || novaCabeca.y >= linhas) {
      fimDeJogo();
      return;
    }

    if (cobra.some(seg => seg.x === novaCabeca.x && seg.y === novaCabeca.y)) {
      fimDeJogo();
      return;
    }

    cobra.unshift(novaCabeca);

    if (novaCabeca.x === comida.x && novaCabeca.y === comida.y) {
      pontos += 10;
      totalMacas += 1;
      lsSet('cobrinha-total-macas', totalMacas);
      moedas += 1;
      salvarMoedas();
      elPontos.textContent = pontos;
      tocarSom('comer');

      const novoNivel = Math.floor(pontos / 50) + 1;
      if (novoNivel !== nivel) {
        nivel = novoNivel;
        elNivel.textContent = nivel;
        reiniciarLoop();
        mostrarToast(`⬆️ Nível ${nivel}!`);
      }

      verificarConquistas();
      posicionarComida();
    } else {
      cobra.pop();
    }

    desenhar();
  }

  function fimDeJogo() {
    jogoAtivo = false;
    if (idIntervalo) clearInterval(idIntervalo);
    tocarSom('colisao');

    let moedasGanhas = Math.floor(pontos / 10);
    if (pontos > recorde) {
      recorde = pontos;
      lsSet('cobrinha-recorde', recorde);
      elRecorde.textContent = recorde;
      moedasGanhas += 10;
      mensagem.textContent = '🎉 Novo Recorde!';
    } else {
      mensagem.textContent = 'Fim de Jogo!';
    }
    moedas += moedasGanhas;
    salvarMoedas();

    salvarPontuacaoRanking(pontos);
    verificarConquistas();

    pontosFinal.textContent = `Pontuação: ${pontos}`;
    moedasFinal.textContent = `🪙 +${moedasGanhas} moedas`;
    overlay.classList.add('ativo');
  }

  function alternarPausa() {
    if (!jogoAtivo) return;
    pausado = !pausado;
    mostrarToast(pausado ? '⏸️ Pausado' : '▶️ Continuando');
  }

  // ---------- Desenho ----------
  function desenhar() {
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < colunas; c++) {
        ctx.fillStyle = (c + l) % 2 === 0 ? corGradeA : corGradeB;
        ctx.fillRect(c * tamanhoBloco, l * tamanhoBloco, tamanhoBloco, tamanhoBloco);
      }
    }

    // comida (maçã)
    const cx = comida.x * tamanhoBloco + tamanhoBloco / 2;
    const cy = comida.y * tamanhoBloco + tamanhoBloco / 2;
    const raioMaca = tamanhoBloco / 2 - 3;
    const pulso = Math.sin(Date.now() / 260) * 0.6;
    ctx.save();
    ctx.shadowColor = 'rgba(248,113,113,0.85)';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy + 1, raioMaca + pulso, 0, Math.PI * 2);
    ctx.fill();
    // brilho
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - raioMaca * 0.35, cy - raioMaca * 0.35, raioMaca * 0.28, 0, Math.PI * 2);
    ctx.fill();
    // cabinho
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - raioMaca);
    ctx.lineTo(cx + 1.5, cy - raioMaca - 4);
    ctx.stroke();
    // folhinha
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - raioMaca - 3, 3.2, 1.8, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // cobra — corpo contínuo e afunilado, com cabeça brilhosa, olhos e língua
    const skin = skins.find(s => s.id === skinAtual) || skins[0];
    const tempo = Date.now();
    const larguraCabeca = tamanhoBloco - 3;
    const larguraCauda = 5;
    const centro = (seg) => ({ x: seg.x * tamanhoBloco + tamanhoBloco / 2, y: seg.y * tamanhoBloco + tamanhoBloco / 2 });

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = skin.brilho;
    ctx.shadowBlur = 7;
    // desenha do rabo para a cabeça, um segmento de linha grossa entre cada par de pontos
    for (let i = cobra.length - 1; i >= 1; i--) {
      const a = centro(cobra[i]);
      const b = centro(cobra[i - 1]);
      // ao atravessar a borda (modo sem parede) os pontos ficam longe um do outro: não liga os dois lados
      if (Math.abs(a.x - b.x) > tamanhoBloco * 1.5 || Math.abs(a.y - b.y) > tamanhoBloco * 1.5) continue;
      const t = i / (cobra.length - 1); // 1 = ponta do rabo, 0 = perto da cabeça
      const largura = larguraCauda + (larguraCabeca - larguraCauda) * (1 - t);
      ctx.strokeStyle = corDoSegmento(skin, t, i, tempo);
      ctx.lineWidth = largura;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // reforço de brilho sutil por cima (efeito "verniz")
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    for (let i = cobra.length - 1; i >= 1; i--) {
      const a = centro(cobra[i]);
      const b = centro(cobra[i - 1]);
      if (Math.abs(a.x - b.x) > tamanhoBloco * 1.5 || Math.abs(a.y - b.y) > tamanhoBloco * 1.5) continue;
      const t = i / (cobra.length - 1);
      ctx.lineWidth = Math.max((larguraCauda + (larguraCabeca - larguraCauda) * (1 - t)) * 0.35, 1.5);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 1.5);
      ctx.lineTo(b.x, b.y - 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // cabeça
    if (cobra.length > 0) {
      const cab = centro(cobra[0]);
      const raioCabeca = larguraCabeca / 2;
      ctx.save();
      ctx.shadowColor = skin.brilho;
      ctx.shadowBlur = 12;
      ctx.fillStyle = corDoSegmento(skin, 0, 0, tempo);
      ctx.beginPath();
      ctx.arc(cab.x, cab.y, raioCabeca, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // perpendicular à direção, para posicionar olhos/língua
      const perpX = -direcao.y, perpY = direcao.x;
      const afastOlhos = raioCabeca * 0.42;
      const frenteOlhos = raioCabeca * 0.28;

      // língua (some e aparece periodicamente)
      if (jogoAtivo && Math.floor(tempo / 500) % 2 === 0) {
        const pontaX = cab.x + direcao.x * (raioCabeca + 7);
        const pontaY = cab.y + direcao.y * (raioCabeca + 7);
        const baseX = cab.x + direcao.x * raioCabeca;
        const baseY = cab.y + direcao.y * raioCabeca;
        ctx.save();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(pontaX, pontaY);
        ctx.moveTo(pontaX, pontaY);
        ctx.lineTo(pontaX + perpX * 2.5 - direcao.x * 2, pontaY + perpY * 2.5 - direcao.y * 2);
        ctx.moveTo(pontaX, pontaY);
        ctx.lineTo(pontaX - perpX * 2.5 - direcao.x * 2, pontaY - perpY * 2.5 - direcao.y * 2);
        ctx.stroke();
        ctx.restore();
      }

      // olhos
      [1, -1].forEach(lado => {
        const ox = cab.x + direcao.x * frenteOlhos + perpX * afastOlhos * lado;
        const oy = cab.y + direcao.y * frenteOlhos + perpY * afastOlhos * lado;
        ctx.save();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.arc(ox, oy, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ox + direcao.x * 1.1, oy + direcao.y * 1.1, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    if (pausado && jogoAtivo) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,25,0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 24px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏸️ Pausado', canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }

  // ---------- Controles ----------
  function definirDirecao(x, y) {
    if (!jogoAtivo || pausado) return;
    // impede inverter o sentido diretamente sobre o próprio corpo
    if (cobra.length > 1 && x === -direcao.x && y === -direcao.y) return;
    proximaDirecao = { x, y };
  }

  document.addEventListener('keydown', (ev) => {
    switch (ev.key) {
      case 'ArrowUp': case 'w': case 'W': definirDirecao(0, -1); ev.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': definirDirecao(0, 1); ev.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': definirDirecao(-1, 0); ev.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': definirDirecao(1, 0); ev.preventDefault(); break;
      case ' ': alternarPausa(); ev.preventDefault(); break;
    }
  });

  document.getElementById('cima').addEventListener('click', () => definirDirecao(0, -1));
  document.getElementById('baixo').addEventListener('click', () => definirDirecao(0, 1));
  document.getElementById('esquerda').addEventListener('click', () => definirDirecao(-1, 0));
  document.getElementById('direita').addEventListener('click', () => definirDirecao(1, 0));

  // swipe (toque)
  let toqueInicioX = 0, toqueInicioY = 0;
  canvas.addEventListener('touchstart', (ev) => {
    const t = ev.changedTouches[0];
    toqueInicioX = t.clientX; toqueInicioY = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', (ev) => {
    const t = ev.changedTouches[0];
    const dx = t.clientX - toqueInicioX;
    const dy = t.clientY - toqueInicioY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // toque muito pequeno, ignora
    if (Math.abs(dx) > Math.abs(dy)) {
      definirDirecao(dx > 0 ? 1 : -1, 0);
    } else {
      definirDirecao(0, dy > 0 ? 1 : -1);
    }
  }, { passive: true });

  document.getElementById('reiniciar').addEventListener('click', iniciarJogo);
  document.getElementById('btnReiniciar2').addEventListener('click', iniciarJogo);

  // ---------- Início ----------
  if (!armazenamentoDisponivel) {
    mostrarToast('⚠️ Progresso não será salvo neste navegador');
  }
  salvarMoedas();
  iniciarJogo();
})();