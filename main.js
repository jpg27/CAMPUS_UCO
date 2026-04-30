const BASE = window.BASE_URL || './';

const BLOQUES = [
  {
    nombre: "Bloque M",
    archivo: "sprites/Bloque_M.png",
    descripcion: "Bloque principal de la universidad.",
    icono: "🏫",
    x: -1.00, y: 1.75, ancho: 2.1
  },
  {
    nombre: "Bloque COL",
    archivo: "sprites/Bloque_Col.png",
    descripcion: "Edificio de laboratorios.",
    icono: "🔬",
    x: -2.00, y: 1.55, ancho: 1.90
  },
  {
    nombre: "Bloque EDC",
    archivo: "sprites/Bloque_EDC.png",
    descripcion: "Centro de desarrollo estudiantil.",
    icono: "📚",
    x: -2.55, y: -2.22, ancho: 1.85
  },
  {
    nombre: "Bloque INNOVA",
    archivo: "sprites/Bloque_INNOVA.png",
    descripcion: "Centro de innovación y tecnología.",
    icono: "💡",
    x: 2.38, y: 0.20, ancho: 0.95
  },
  {
    nombre: "Bloque Nuevo",
    archivo: "sprites/Bloque_Nuevo_v2.png",
    descripcion: "Bloque de construcción reciente.",
    icono: "🏗️",
    x: 1.32, y: -0.12, ancho: 1.65
  },
  {
    nombre: "Edificio J",
    archivo: "sprites/Bloque_J.png",
    descripcion: "Edificio administrativo J.",
    icono: "🏢",
    x: 0.0, y: -1.10, ancho: 1.2
  },
  {
    nombre: "Bloque D y E",
    archivo: "sprites/Bloque_D_E.png",
    descripcion: "Bloques de ingeniería.",
    icono: "⚙️",
    x: 1.99, y: 0.64, ancho: 1.5
  },
  {
    nombre: "Auditorio",
    archivo: "sprites/Auditorio.png",
    descripcion: "Auditorio principal.",
    icono: "🎭",
    x: 0.38, y: 2.07, ancho: 1.15
  },
  {
    nombre: "Capilla",
    archivo: "sprites/Capilla.png",
    descripcion: "Capilla del campus.",
    icono: "⛪",
    x: 3.03, y: 0.08, ancho: 0.4
  },
  {
    nombre: "Coliseo",
    archivo: "sprites/Coliseo.png",
    descripcion: "Coliseo deportivo.",
    icono: "🏟️",
    x: -2.37, y: 0.50, ancho: 1.3
  }
];

// ═══════════════════════════════════════════
// SETUP THREEJS
// ═══════════════════════════════════════════
const scene    = new THREE.Scene();
const camera   = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

function ajustarCamara() {
  const aspect = window.innerWidth / window.innerHeight;
  // Ajuste para que el campus ocupe toda la pantalla
  const size   = aspect < 1 ? 4.0 / aspect : 4.0;
  camera.left   = -size * aspect;
  camera.right  =  size * aspect;
  camera.top    =  size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
ajustarCamara();
window.addEventListener('resize', ajustarCamara);

// ═══════════════════════════════════════════
// CARGAR FONDO
// ═══════════════════════════════════════════
const loader = new THREE.TextureLoader();

loader.load(BASE + 'sprites/campus.png', (textura) => {
  const proporcionFondo = textura.image.width / textura.image.height;
  const altoFinal = 8;
  const anchoFinal = altoFinal * proporcionFondo;
  const geo   = new THREE.PlaneGeometry(anchoFinal, altoFinal);
  const mat   = new THREE.MeshBasicMaterial({ map: textura, transparent: true });
  const fondo = new THREE.Mesh(geo, mat);
  fondo.position.z = 0;
  scene.add(fondo);
});

// ═══════════════════════════════════════════
// CARGAR BLOQUES CON PROPORCIONES REALES
// ═══════════════════════════════════════════
const meshBloques        = [];
const colorNormal        = new THREE.Color(1, 1, 1);
const colorSeleccion     = new THREE.Color(1, 0.85, 0);
let   bloqueSeleccionado = null;

BLOQUES.forEach((bloque) => {
  loader.load(BASE + bloque.archivo, (textura) => {
    const proporcion = textura.image.width / textura.image.height;
    const anchoFinal = bloque.ancho;
    const altoFinal  = anchoFinal / proporcion;

    const geo = new THREE.PlaneGeometry(anchoFinal, altoFinal);
    const mat = new THREE.MeshBasicMaterial({
      map: textura,
      transparent: true,
      color: colorNormal
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bloque.x, bloque.y, 1);
    mesh.userData = bloque;

    const canvas  = document.createElement('canvas');
    canvas.width  = textura.image.width;
    canvas.height = textura.image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(textura.image, 0, 0);
    mesh.userData.alphaCanvas = canvas;
    mesh.userData.alphaCtx    = ctx;

    scene.add(mesh);
    meshBloques.push(mesh);
  });
});

// ═══════════════════════════════════════════
// DETECCIÓN POR PIXEL (ignora transparencia)
// ═══════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

function obtenerPosicion(x, y) {
  mouse.x =  (x / window.innerWidth)  * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
}

function detectarBloque() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(meshBloques);

  let tocado = null;

  for (const hit of hits) {
    const mesh   = hit.object;
    const uv     = hit.uv;
    if (!uv) continue;

    const canvas = mesh.userData.alphaCanvas;
    const ctx    = mesh.userData.alphaCtx;
    if (!canvas || !ctx) continue;

    const px    = Math.floor(uv.x * canvas.width);
    const py    = Math.floor((1 - uv.y) * canvas.height);
    const alpha = ctx.getImageData(px, py, 1, 1).data[3];

    if (alpha > 10) {
      tocado = mesh;
      break;
    }
  }

  if (tocado) {
    if (bloqueSeleccionado && bloqueSeleccionado !== tocado) {
      bloqueSeleccionado.material.color.set(colorNormal);
    }
    tocado.material.color.set(colorSeleccion);
    bloqueSeleccionado = tocado;
    mostrarPanel(tocado.userData);
  } else {
    if (bloqueSeleccionado) {
      bloqueSeleccionado.material.color.set(colorNormal);
      bloqueSeleccionado = null;
    }
    ocultarPanel();
  }
}

// PC
window.addEventListener('click', (e) => {
  obtenerPosicion(e.clientX, e.clientY);
  detectarBloque();
});

// Móvil
window.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  obtenerPosicion(t.clientX, t.clientY);
  detectarBloque();
});

// ═══════════════════════════════════════════
// PANEL DE INFORMACIÓN
// ═══════════════════════════════════════════
const panel       = document.getElementById('info-panel');
const panelTitulo = document.getElementById('panel-titulo');
const panelDesc   = document.getElementById('panel-descripcion');
const panelIcono  = document.getElementById('panel-icono');
const btnCerrar   = document.getElementById('cerrar-panel');

function mostrarPanel(datos) {
  panelTitulo.textContent = datos.nombre;
  panelDesc.textContent   = datos.descripcion;
  panelIcono.textContent  = datos.icono || '🏛️';
  panel.classList.add('visible');
}

function ocultarPanel() {
  panel.classList.remove('visible');
}

btnCerrar.addEventListener('click', () => {
  ocultarPanel();
  if (bloqueSeleccionado) {
    bloqueSeleccionado.material.color.set(colorNormal);
    bloqueSeleccionado = null;
  }
});

// ═══════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════
function animar() {
  requestAnimationFrame(animar);
  renderer.render(scene, camera);
}
animar();