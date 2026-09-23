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
      linha.innerHTML = `
        <div class="conquista-icone">${desbloqueada ? '🏆' : '🔒'}</div>
        <div class="conquista-texto">
          <div class="conquista-nome">${cq.nome}</div>
          <div class="conquista-desc">${cq.desc}</div>
        </div>
        <div class="conquista-recompensa">🪙 ${cq.recompensa}</div>`;
      listaConquistas.appendChild(linha);
    });
  }
  document.getElementById('btnConquistas').onclick = () => { renderizarConquistas(); overlayConquistas.classList.add('ativo'); };
  document.getElementById('fecharConquistas').onclick = () => overlayConquistas.classList.remove('ativo');

  // ---------- Ranking local ----------
  function carregarRanking() { return carregarLista('cobrinha-ranking', []); }
  function registrarRanking(pontosPartida, nivelPartida) {
    let lista = carregarRanking();
    lista.push({ pontos: pontosPartida, nivel: nivelPartida, data: new Date().toLocaleDateString('pt-br') });
    lista.sort((a, b) => b.pontos - a.pontos);
    lista = lista.slice(0, 5);
    salvarLista('cobrinha-ranking', lista);
  }
  function renderizarRanking() {
    const lista = carregarRanking();
    listaRanking.innerHTML = '';
    if (lista.length === 0) {
      listaRanking.innerHTML = '<p style="opacity:0.7;">Nenhum recorde ainda. Jogue para aparecer aqui!</p>';
      return;
    }
    lista.forEach((item, i) => {
      const linha = document.createElement('div');
      linha.className = 'ranking-linha';
      linha.innerHTML = `
        <div class="ranking-pos">${i + 1}º</div>
        <div class="ranking-info">${item.pontos} pontos <span style="opacity:0.6;">(nível ${item.nivel})</span></div>
        <div class="ranking-data">${item.data}</div>`;
      listaRanking.appendChild(linha);
    });
  }
  document.getElementById('btnRanking').onclick = () => { renderizarRanking(); overlayRanking.classList.add('ativo'); };
  document.getElementById('btnRankingOverlay').onclick = () => { renderizarRanking(); overlayRanking.classList.add('ativo'); };
  document.getElementById('fecharRanking').onclick = () => overlayRanking.classList.remove('ativo');

  // ---------- Bônus diário ----------
  function verificarBonusDiario() {
    const hoje = new Date().toDateString();
    const ultimo = lsGet('cobrinha-ultimo-bonus');
    if (ultimo === hoje) return;
    const ontem = new Date(Date.now() - 86400000).toDateString();
    let streak = Number(lsGet('cobrinha-streak')) || 0;
    streak = (ultimo === ontem) ? streak + 1 : 1;
    if (streak > 7) streak = 7;
    const bonus = 10 + streak * 5;
    moedas += bonus;
    salvarMoedas();
    lsSet('cobrinha-ultimo-bonus', hoje);
    lsSet('cobrinha-streak', streak);
    setTimeout(() => mostrarToast(`🎁 Bônus diário: +${bonus} 🪙 (sequência: ${streak} dia${streak > 1 ? 's' : ''})`), 600);
  }

  // ---------- Partículas ----------
  let particulas = [];
  function criarParticulas(x, y, cor, qtd, forca) {
    for (let i = 0; i < qtd; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = forca * (0.4 + Math.random() * 0.6);
      particulas.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 1, cor });
    }
    if (particulas.length > 400) particulas = particulas.slice(-400);
  }
  function atualizarParticulas() {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.vida -= 0.05;
      if (p.vida <= 0) particulas.splice(i, 1);
    }
  }
  function desenharParticulas() {
    particulas.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(p.vida, 0);
      ctx.fillStyle = p.cor;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // ---------- Jogo ----------
  let cobra, direcao, proximaDirecao, comida, pontos, recorde, velocidade, loopId, jogando, pausado, nivel, obstaculos;
  let execucaoId = 0; // identifica cada "rodada" (evita que animações antigas interfiram numa partida nova)

  recorde = Number(lsGet('cobrinha-recorde')) || 0;
  elRecorde.textContent = recorde;
  salvarMoedas();
  verificarBonusDiario();

  function iniciar() {
    execucaoId++;
    cobra = [ { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 } ];
    direcao = { x: 1, y: 0 };
    proximaDirecao = direcao;
    pontos = 0;
    velocidade = 140;
    nivel = 1;
    obstaculos = [];
    particulas = [];
    pausado = false;
    elPontos.textContent = pontos;
    elNivel.textContent = nivel;
    overlay.classList.remove('ativo');
    posicionarComida();
    jogando = true;
    if (loopId) clearTimeout(loopId);
    loop();
  }

  function celulaLivre(x, y, margemDaCabeca) {
    if (cobra.some(seg => seg.x === x && seg.y === y)) return false;
    if (comida && comida.x === x && comida.y === y) return false;
    if (obstaculos.some(o => o.x === x && o.y === y)) return false;
    if (margemDaCabeca) {
      const cab = cobra[0];
      if (Math.abs(cab.x - x) + Math.abs(cab.y - y) < 4) return false;
    }
    return true;
  }

  function posicionarComida() {
    let livre = false;
    let tentativas = 0;
    while (!livre && tentativas < 500) {
      tentativas++;
      const x = Math.floor(Math.random() * colunas);
      const y = Math.floor(Math.random() * linhas);
      livre = celulaLivre(x, y, false);
      if (livre) comida = { x, y };
    }
    if (!livre) comida = comida || { x: 0, y: 0 };
  }

  function atualizarNivel() {
    const novoNivel = Math.floor(pontos / 50) + 1;
    if (novoNivel > nivel) { nivel = novoNivel; elNivel.textContent = nivel; gerarObstaculos(); }
  }

  function gerarObstaculos() {
    const alvo = Math.min(nivel - 1, 12);
    let tentativas = 0;
    while (obstaculos.length < alvo && tentativas < 300) {
      tentativas++;
      const x = Math.floor(Math.random() * colunas);
      const y = Math.floor(Math.random() * linhas);
      if (celulaLivre(x, y, true)) obstaculos.push({ x, y });
    }
  }

  function loop() {
    if (!jogando) return;
    try {
      if (!pausado) atualizar();
      desenhar();
      if (pausado) desenharPausa();
    } catch (erro) {
      console.error('Erro no jogo da cobrinha (quadro ignorado):', erro);
    }
    loopId = setTimeout(loop, velocidade);
  }

  function atualizar() {
    direcao = proximaDirecao;
    let cabeca = { x: cobra[0].x + direcao.x, y: cobra[0].y + direcao.y };

    const foraDoMapa = cabeca.x < 0 || cabeca.x >= colunas || cabeca.y < 0 || cabeca.y >= linhas;
    if (foraDoMapa) {
      if (semParede) cabeca = { x: (cabeca.x + colunas) % colunas, y: (cabeca.y + linhas) % linhas };
      else return fimDeJogo();
    }

    if (cobra.some(seg => seg.x === cabeca.x && seg.y === cabeca.y)) return fimDeJogo();
    if (obstaculos.some(o => o.x === cabeca.x && o.y === cabeca.y)) return fimDeJogo();

    cobra.unshift(cabeca);

    if (comida && cabeca.x === comida.x && cabeca.y === comida.y) {
      pontos += 10;
      moedas += 1;
      totalMacas += 1;
      lsSet('cobrinha-total-macas', totalMacas);
      elPontos.textContent = pontos;
      salvarMoedas();
      tocarSom('comer');
      criarParticulas(comida.x * tamanhoBloco + tamanhoBloco / 2, comida.y * tamanhoBloco + tamanhoBloco / 2, '#fbbf24', 12, 2.6);
      if (velocidade > 60) velocidade -= 3;
      atualizarNivel();
      verificarConquistas();
      posicionarComida();
    } else {
      cobra.pop();
    }
  }

  function retangulo(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function desenharFundo() {
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < colunas; c++) {
        ctx.fillStyle = (l + c) % 2 === 0 ? corGradeA : corGradeB;
        ctx.fillRect(c * tamanhoBloco, l * tamanhoBloco, tamanhoBloco, tamanhoBloco);
      }
    }
  }

  function desenharObstaculos() {
    obstaculos.forEach(o => {
      const x = o.x * tamanhoBloco, y = o.y * tamanhoBloco;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
      ctx.fillStyle = '#57534e';
      retangulo(x + 2, y + 2, tamanhoBloco - 4, tamanhoBloco - 4, 4);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      retangulo(x + 4, y + 4, tamanhoBloco - 8, tamanhoBloco - 8, 3);
      ctx.stroke();
    });
  }

  function desenharComida() {
    if (!comida) return;
    const cx = comida.x * tamanhoBloco + tamanhoBloco / 2;
    const cy = comida.y * tamanhoBloco + tamanhoBloco / 2;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy - tamanhoBloco / 2 + 2, 4, 2.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    const pulso = 1 + Math.sin(Date.now() / 200) * 0.06;
    ctx.save();
    ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, (tamanhoBloco / 2 - 2) * pulso, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  function desenharCobra() {
    const skin = skins.find(s => s.id === skinAtual) || skins[0];
    const tempo = Date.now();
    const total = cobra.length;

    for (let i = total - 1; i >= 1; i--) {
      const seg = cobra[i];
      const t = total > 1 ? i / (total - 1) : 0;
      const escala = 0.55 + 0.45 * (1 - t);
      const w = tamanhoBloco * escala;
      const cx = seg.x * tamanhoBloco + tamanhoBloco / 2;
      const cy = seg.y * tamanhoBloco + tamanhoBloco / 2;
      const cor = corDoSegmento(skin, 1 - t, i, tempo);
      ctx.save();
      ctx.shadowColor = skin.brilho; ctx.shadowBlur = 6;
      ctx.fillStyle = cor;
      retangulo(cx - w/2, cy - w/2, w, w, w/2.4);
      ctx.fill();
      ctx.restore();
    }

    const cabeca = cobra[0];
    const cx = cabeca.x * tamanhoBloco + tamanhoBloco / 2;
    const cy = cabeca.y * tamanhoBloco + tamanhoBloco / 2;
    const corCabeca = corDoSegmento(skin, 0, 0, tempo);
    const w = tamanhoBloco * 1.05;

    ctx.save();
    ctx.translate(cx, cy);
    const angulo = Math.atan2(direcao.y, direcao.x);
    ctx.rotate(angulo);

    const mostrarLingua = Math.sin(tempo / 130) > 0.3;
    if (mostrarLingua) {
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w/2 + 8, 0); ctx.lineTo(w/2 + 12, -4);
      ctx.moveTo(w/2 + 8, 0); ctx.lineTo(w/2 + 12, 4);
      ctx.stroke();
    }

    ctx.shadowColor = skin.brilho; ctx.shadowBlur = 10;
    ctx.fillStyle = corCabeca;
    retangulo(-w/2, -w/2, w, w, w/2.2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const olhoX = w * 0.12, olhoY = w * 0.28;
    [-1, 1].forEach(sinal => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(olhoX, sinal * olhoY, w * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(olhoX + w * 0.05, sinal * olhoY, w * 0.08, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function desenharPausa() {
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,25,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSADO', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillText('aperte ESPAÇO para continuar', canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }

  function desenhar() {
    desenharFundo();
    desenharObstaculos();
    desenharComida();
    desenharCobra();
    atualizarParticulas();
    desenharParticulas();
  }

  function fimDeJogo() {
    if (!jogando) return;
    jogando = false;
    clearTimeout(loopId);
    tocarSom('colisao');

    const idDestaPartida = execucaoId;
    const skin = skins.find(s => s.id === skinAtual) || skins[0];
    const tempo = Date.now();
    const pontosDaPartida = pontos;
    const nivelDaPartida = nivel;

    cobra.forEach((seg, i) => {
      const t = cobra.length > 1 ? i / (cobra.length - 1) : 0;
      const cor = corDoSegmento(skin, t, i, tempo);
      criarParticulas(seg.x * tamanhoBloco + tamanhoBloco / 2, seg.y * tamanhoBloco + tamanhoBloco / 2, cor, 6, 3.8);
    });

    let quadros = 0;
    function passoExplosao() {
      if (idDestaPartida !== execucaoId) return;
      try {
        desenharFundo(); desenharObstaculos(); desenharComida();
        atualizarParticulas(); desenharParticulas();
      } catch (erro) {
        console.error('Erro na animação de explosão (ignorado):', erro);
      }
      quadros++;
      if (quadros < 45 && particulas.length > 0) {
        requestAnimationFrame(passoExplosao);
      } else {
        mostrarTelaFim(pontosDaPartida, nivelDaPartida);
      }
    }
    passoExplosao();
  }

  function mostrarTelaFim(pontosDaPartida, nivelDaPartida) {
    registrarRanking(pontosDaPartida, nivelDaPartida);
    if (pontosDaPartida > recorde) {
      recorde = pontosDaPartida;
      lsSet('cobrinha-recorde', recorde);
      elRecorde.textContent = recorde;
      mensagem.textContent = '🏆 Novo Recorde!';
    } else {
      mensagem.textContent = 'Fim de Jogo!';
    }
    pontosFinal.textContent = `Você fez ${pontosDaPartida} pontos (nível ${nivelDaPartida})`;
    moedasFinal.textContent = `🪙 Moedas totais: ${moedas}`;
    overlay.classList.add('ativo');
  }

  function mudarDirecao(nx, ny) {
    if (nx === -direcao.x && ny === -direcao.y) return;
    proximaDirecao = { x: nx, y: ny };
  }

  function alternarPausa() { if (!jogando) return; pausado = !pausado; }

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); alternarPausa(); return; }
    if (pausado) return;
    switch (e.key) {
      case 'ArrowUp': mudarDirecao(0, -1); break;
      case 'ArrowDown': mudarDirecao(0, 1); break;
      case 'ArrowLeft': mudarDirecao(-1, 0); break;
      case 'ArrowRight': mudarDirecao(1, 0); break;
    }
  });

  // ---------- Swipe (toque no celular) ----------
  let toqueInicioX = 0, toqueInicioY = 0;
  const LIMIAR_SWIPE = 22;
  canvas.addEventListener('touchstart', (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const t = e.changedTouches[0];
    toqueInicioX = t.clientX; toqueInicioY = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (pausado) return;
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toqueInicioX, dy = t.clientY - toqueInicioY;
    if (Math.abs(dx) < LIMIAR_SWIPE && Math.abs(dy) < LIMIAR_SWIPE) return;
    if (Math.abs(dx) > Math.abs(dy)) mudarDirecao(dx > 0 ? 1 : -1, 0);
    else mudarDirecao(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  document.getElementById('cima').addEventListener('click', () => mudarDirecao(0, -1));
  document.getElementById('baixo').addEventListener('click', () => mudarDirecao(0, 1));
  document.getElementById('esquerda').addEventListener('click', () => mudarDirecao(-1, 0));
  document.getElementById('direita').addEventListener('click', () => mudarDirecao(1, 0));
  document.getElementById('reiniciar').addEventListener('click', iniciar);
  document.getElementById('btnReiniciar2').addEventListener('click', iniciar);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && jogando && !pausado) pausado = true;
  });

  try {
    iniciar();
  } catch (erroInicial) {
    console.error('Falha ao iniciar o jogo da cobrinha:', erroInicial);
  }
})();