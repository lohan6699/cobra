const canvas = document.getElementById('tela');
const ctx = canvas.getContext('2d');
const tamanhoBloco = 20;
const colunas = canvas.width / tamanhoBloco;
const linhas = canvas.height / tamanhoBloco;

const elPontos = document.getElementById('pontos');
const elRecorde = document.getElementById('recorde');
const elMoedas = document.getElementById('moedas');
const elMoedasLoja = document.getElementById('moedasLoja');
const overlay = document.getElementById('overlay');
const overlayLoja = document.getElementById('overlayLoja');
const mensagem = document.getElementById('mensagem');
const pontosFinal = document.getElementById('pontosFinal');
const moedasFinal = document.getElementById('moedasFinal');
const gradeSkins = document.getElementById('gradeSkins');

// ---------- Skins ----------
const skins = [
  { id: 'classica',  nome: 'Clássica',   preco: 0,   cor1: '#4ade80', cor2: '#15803d', brilho: 'rgba(74,222,128,0.55)' },
  { id: 'neon',      nome: 'Neon',       preco: 50,  cor1: '#22d3ee', cor2: '#a21caf', brilho: 'rgba(34,211,238,0.7)'  },
  { id: 'fogo',      nome: 'Fogo',       preco: 80,  cor1: '#fde047', cor2: '#b91c1c', brilho: 'rgba(249,115,22,0.7)' },
  { id: 'gelo',      nome: 'Gelo',       preco: 100, cor1: '#f0f9ff', cor2: '#0284c7', brilho: 'rgba(125,211,252,0.7)'},
  { id: 'ouro',      nome: 'Ouro',       preco: 150, cor1: '#fef9c3', cor2: '#a16207', brilho: 'rgba(250,204,21,0.7)' },
  { id: 'arcoiris',  nome: 'Arco-íris',  preco: 200, cor1: 'rainbow', cor2: 'rainbow', brilho: 'rgba(255,255,255,0.7)'}
];

function carregarDesbloqueadas() {
  try {
    return JSON.parse(localStorage.getItem('cobrinha-skins-desbloqueadas')) || ['classica'];
  } catch { return ['classica']; }
}
function salvarDesbloqueadas(lista) {
  localStorage.setItem('cobrinha-skins-desbloqueadas', JSON.stringify(lista));
}

let desbloqueadas = carregarDesbloqueadas();
let skinAtual = localStorage.getItem('cobrinha-skin') || 'classica';
let moedas = Number(localStorage.getItem('cobrinha-moedas')) || 0;

function salvarMoedas() {
  localStorage.setItem('cobrinha-moedas', moedas);
  elMoedas.textContent = moedas;
  elMoedasLoja.textContent = moedas;
}

function hexParaRgb(hex) {
  const v = parseInt(hex.replace('#',''), 16);
  return { r: (v>>16)&255, g: (v>>8)&255, b: v&255 };
}
function misturarCor(hexA, hexB, t) {
  const a = hexParaRgb(hexA), b = hexParaRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function corDoSegmento(skin, t, indice, tempo) {
  if (skin.cor1 === 'rainbow') {
    const matiz = (indice * 22 + tempo / 8) % 360;
    return `hsl(${matiz}, 85%, 60%)`;
  }
  return misturarCor(skin.cor1, skin.cor2, t);
}

function renderizarLoja() {
  elMoedasLoja.textContent = moedas;
  gradeSkins.innerHTML = '';
  skins.forEach(skin => {
    const desbloqueada = desbloqueadas.includes(skin.id);
    const equipada = skinAtual === skin.id;

    const card = document.createElement('div');
    card.className = 'skin-card' + (equipada ? ' equipada' : '');

    const amostra = document.createElement('div');
    amostra.className = 'skin-amostra';
    amostra.style.background = skin.cor1 === 'rainbow'
      ? 'linear-gradient(90deg, red, orange, yellow, green, blue, violet)'
      : `linear-gradient(90deg, ${skin.cor1}, ${skin.cor2})`;

    const nome = document.createElement('div');
    nome.className = 'skin-nome';
    nome.textContent = skin.nome;

    const preco = document.createElement('div');
    preco.className = 'skin-preco';
    preco.textContent = skin.preco === 0 ? 'Grátis' : `🪙 ${skin.preco}`;

    const botao = document.createElement('button');
    if (equipada) {
      botao.textContent = '✅ Equipada';
      botao.disabled = true;
    } else if (desbloqueada) {
      botao.textContent = 'Equipar';
      botao.onclick = () => { skinAtual = skin.id; localStorage.setItem('cobrinha-skin', skinAtual); renderizarLoja(); };
    } else {
      botao.textContent = `Comprar 🪙 ${skin.preco}`;
      botao.disabled = moedas < skin.preco;
      botao.onclick = () => {
        if (moedas >= skin.preco) {
          moedas -= skin.preco;
          desbloqueadas.push(skin.id);
          salvarDesbloqueadas(desbloqueadas);
          salvarMoedas();
          skinAtual = skin.id;
          localStorage.setItem('cobrinha-skin', skinAtual);
          renderizarLoja();
        }
      };
    }

    card.appendChild(amostra);
    card.appendChild(nome);
    card.appendChild(preco);
    card.appendChild(botao);
    gradeSkins.appendChild(card);
  });
}

document.getElementById('btnLoja').onclick = () => { renderizarLoja(); overlayLoja.classList.add('ativo'); };
document.getElementById('btnLojaOverlay').onclick = () => { overlay.classList.remove('ativo'); renderizarLoja(); overlayLoja.classList.add('ativo'); };
document.getElementById('fecharLoja').onclick = () => overlayLoja.classList.remove('ativo');

// ---------- Jogo ----------
let cobra, direcao, proximaDirecao, comida, pontos, recorde, velocidade, loopId, jogando;

recorde = Number(localStorage.getItem('cobrinha-recorde')) || 0;
elRecorde.textContent = recorde;
salvarMoedas();

function iniciar() {
  cobra = [ { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 } ];
  direcao = { x: 1, y: 0 };
  proximaDirecao = direcao;
  pontos = 0;
  velocidade = 140;
  elPontos.textContent = pontos;
  overlay.classList.remove('ativo');
  posicionarComida();
  jogando = true;
  if (loopId) clearTimeout(loopId);
  loop();
}

function posicionarComida() {
  let livre = false;
  while (!livre) {
    comida = { x: Math.floor(Math.random() * colunas), y: Math.floor(Math.random() * linhas) };
    livre = !cobra.some(seg => seg.x === comida.x && seg.y === comida.y);
  }
}

function loop() {
  if (!jogando) return;
  atualizar();
  desenhar();
  loopId = setTimeout(loop, velocidade);
}

function atualizar() {
  direcao = proximaDirecao;
  const cabeca = { x: cobra[0].x + direcao.x, y: cobra[0].y + direcao.y };

  if (cabeca.x < 0 || cabeca.x >= colunas || cabeca.y < 0 || cabeca.y >= linhas) return fimDeJogo();
  if (cobra.some(seg => seg.x === cabeca.x && seg.y === cabeca.y)) return fimDeJogo();

  cobra.unshift(cabeca);

  if (cabeca.x === comida.x && cabeca.y === comida.y) {
    pontos += 10;
    moedas += 1;
    elPontos.textContent = pontos;
    salvarMoedas();
    if (velocidade > 60) velocidade -= 3;
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
      ctx.fillStyle = (l + c) % 2 === 0 ? getComputedStyle(document.documentElement).getPropertyValue('--grid-a')
                                         : getComputedStyle(document.documentElement).getPropertyValue('--grid-b');
      ctx.fillRect(c * tamanhoBloco, l * tamanhoBloco, tamanhoBloco, tamanhoBloco);
    }
  }
}

function desenharComida() {
  const cx = comida.x * tamanhoBloco + tamanhoBloco / 2;
  const cy = comida.y * tamanhoBloco + tamanhoBloco / 2;
  // folha
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy - tamanhoBloco / 2 + 2, 4, 2.5, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  // maçã com brilho pulsante
  const pulso = 1 + Math.sin(Date.now() / 200) * 0.06;
  ctx.save();
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, (tamanhoBloco / 2 - 2) * pulso, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function desenharCobra() {
  const skin = skins.find(s => s.id === skinAtual) || skins[0];
  const tempo = Date.now();
  const total = cobra.length;

  // corpo (do rabo para a cabeça, para as sobreposições ficarem corretas)
  for (let i = total - 1; i >= 1; i--) {
    const seg = cobra[i];
    const t = i / (total - 1);
    const escala = 0.55 + 0.45 * (1 - t); // afina em direção ao rabo
    const w = tamanhoBloco * escala;
    const cx = seg.x * tamanhoBloco + tamanhoBloco / 2;
    const cy = seg.y * tamanhoBloco + tamanhoBloco / 2;
    const cor = corDoSegmento(skin, 1 - t, i, tempo);

    ctx.save();
    ctx.shadowColor = skin.brilho;
    ctx.shadowBlur = 6;
    ctx.fillStyle = cor;
    retangulo(cx - w/2, cy - w/2, w, w, w/2.4);
    ctx.fill();
    ctx.restore();
  }

  // cabeça
  const cabeca = cobra[0];
  const cx = cabeca.x * tamanhoBloco + tamanhoBloco / 2;
  const cy = cabeca.y * tamanhoBloco + tamanhoBloco / 2;
  const corCabeca = corDoSegmento(skin, 0, 0, tempo);
  const w = tamanhoBloco * 1.05;

  ctx.save();
  ctx.translate(cx, cy);
  const angulo = Math.atan2(direcao.y, direcao.x);
  ctx.rotate(angulo);

  // língua (bifurcada, com animação de "piscar")
  const mostrarLingua = Math.sin(tempo / 130) > 0.3;
  if (mostrarLingua) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(w/2, 0);
    ctx.lineTo(w/2 + 8, 0);
    ctx.lineTo(w/2 + 12, -4);
    ctx.moveTo(w/2 + 8, 0);
    ctx.lineTo(w/2 + 12, 4);
    ctx.stroke();
  }

  // cabeça (formato de "gota" apontando para frente)
  ctx.shadowColor = skin.brilho;
  ctx.shadowBlur = 10;
  ctx.fillStyle = corCabeca;
  retangulo(-w/2, -w/2, w, w, w/2.2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // olhos
  const olhoX = w * 0.12;
  const olhoY = w * 0.28;
  [-1, 1].forEach(sinal => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(olhoX, sinal * olhoY, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(olhoX + w * 0.05, sinal * olhoY, w * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function desenhar() {
  desenharFundo();
  desenharComida();
  desenharCobra();
}

function fimDeJogo() {
  jogando = false;
  clearTimeout(loopId);
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem('cobrinha-recorde', recorde);
    elRecorde.textContent = recorde;
    mensagem.textContent = '🏆 Novo Recorde!';
  } else {
    mensagem.textContent = 'Fim de Jogo!';
  }
  pontosFinal.textContent = `Você fez ${pontos} pontos`;
  moedasFinal.textContent = `🪙 Moedas totais: ${moedas}`;
  overlay.classList.add('ativo');
}

function mudarDirecao(nx, ny) {
  if (nx === -direcao.x && ny === -direcao.y) return;
  proximaDirecao = { x: nx, y: ny };
}

document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp': mudarDirecao(0, -1); break;
    case 'ArrowDown': mudarDirecao(0, 1); break;
    case 'ArrowLeft': mudarDirecao(-1, 0); break;
    case 'ArrowRight': mudarDirecao(1, 0); break;
  }
});

document.getElementById('cima').addEventListener('click', () => mudarDirecao(0, -1));
document.getElementById('baixo').addEventListener('click', () => mudarDirecao(0, 1));
document.getElementById('esquerda').addEventListener('click', () => mudarDirecao(-1, 0));
document.getElementById('direita').addEventListener('click', () => mudarDirecao(1, 0));
document.getElementById('reiniciar').addEventListener('click', iniciar);
document.getElementById('btnReiniciar2').addEventListener('click', iniciar);

iniciar();