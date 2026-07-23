// ═══════════════════════════════════════════
// MapaView.js — Vista del mapa 3D con Three.js
// Extraído fielmente de main.js original
// ═══════════════════════════════════════════
import { EDIFICIOS, BASE_URL } from '../config.js';

export class MapaView {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.meshBloques = [];
    this.bloqueSeleccionado = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.colorNormal = new THREE.Color(1, 1, 1);
    this.colorSeleccion = new THREE.Color(1, 0.85, 0);
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this._ajustarCamara();
    window.addEventListener('resize', () => this._ajustarCamara());

    return this;
  }

  _ajustarCamara() {
    const aspect = window.innerWidth / window.innerHeight;
    const size = aspect < 1 ? 4.0 / aspect : 4.0;
    this.camera.left   = -size * aspect;
    this.camera.right  =  size * aspect;
    this.camera.top    =  size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  cargarFondo() {
    const loader = new THREE.TextureLoader();
    loader.load(BASE_URL + 'sprites/campus.png', (textura) => {
      const proporcionFondo = textura.image.width / textura.image.height;
      const altoFinal = 8;
      const anchoFinal = altoFinal * proporcionFondo;
      const geo = new THREE.PlaneGeometry(anchoFinal, altoFinal);
      const mat = new THREE.MeshBasicMaterial({ map: textura, transparent: true });
      const fondo = new THREE.Mesh(geo, mat);
      fondo.position.z = 0;
      this.scene.add(fondo);
    });
  }

  cargarBloques() {
    const loader = new THREE.TextureLoader();

    EDIFICIOS.forEach((bloque) => {
      loader.load(BASE_URL + bloque.archivo, (textura) => {
        const proporcion = textura.image.width / textura.image.height;
        const anchoFinal = bloque.ancho;
        const altoFinal  = anchoFinal / proporcion;

        const geo = new THREE.PlaneGeometry(anchoFinal, altoFinal);
        const mat = new THREE.MeshBasicMaterial({
          map: textura,
          transparent: true,
          color: this.colorNormal
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(bloque.x, bloque.y, 1);
        mesh.userData = bloque;

        // Canvas para detección por pixel (ignora transparencia)
        const canvas  = document.createElement('canvas');
        canvas.width  = textura.image.width;
        canvas.height = textura.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(textura.image, 0, 0);
        mesh.userData.alphaCanvas = canvas;
        mesh.userData.alphaCtx    = ctx;

        this.scene.add(mesh);
        this.meshBloques.push(mesh);
      });
    });
  }

  detectarBloque(clientX, clientY) {
    this.mouse.x =  (clientX / window.innerWidth)  * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshBloques);

    for (const hit of hits) {
      const mesh = hit.object;
      const uv   = hit.uv;
      if (!uv) continue;

      const canvas = mesh.userData.alphaCanvas;
      const ctx    = mesh.userData.alphaCtx;
      if (!canvas || !ctx) continue;

      const px    = Math.floor(uv.x * canvas.width);
      const py    = Math.floor((1 - uv.y) * canvas.height);
      const alpha = ctx.getImageData(px, py, 1, 1).data[3];

      if (alpha > 10) {
        return { mesh, edificio: mesh.userData };
      }
    }
    return null;
  }

  seleccionarBloque(mesh) {
    if (this.bloqueSeleccionado && this.bloqueSeleccionado !== mesh) {
      this.bloqueSeleccionado.material.color.set(this.colorNormal);
    }
    mesh.material.color.set(this.colorSeleccion);
    this.bloqueSeleccionado = mesh;
  }

  deseleccionarBloque() {
    if (this.bloqueSeleccionado) {
      this.bloqueSeleccionado.material.color.set(this.colorNormal);
      this.bloqueSeleccionado = null;
    }
  }

  mostrarPanel(datos) {
    document.getElementById('panel-titulo').textContent      = datos.nombre;
    document.getElementById('panel-descripcion').textContent  = datos.descripcion;
    document.getElementById('panel-icono').textContent        = datos.icono || '🏛️';
    document.getElementById('panel-localizacion').textContent = datos.localizacion;
    document.getElementById('info-panel').classList.add('visible');
  }

  ocultarPanel() {
    document.getElementById('info-panel').classList.remove('visible');
  }

  mostrarSesionCerrada() {
    document.getElementById('sesion-cerrada').style.display = 'flex';
  }

  iniciarRenderLoop() {
    const animar = () => {
      requestAnimationFrame(animar);
      this.renderer.render(this.scene, this.camera);
    };
    animar();
  }
}
