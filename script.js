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