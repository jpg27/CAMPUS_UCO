# Campus UCO

Aplicación web de Realidad Aumentada (AR) y Gamificación para explorar los edificios del campus.

## Arquitectura
El proyecto sigue el patrón **MVC (Modelo - Vista - Controlador)** en Vanilla JavaScript (módulos ES6).
- **Models**: Interactúan con la base de datos Supabase (`src/models/`).
- **Views**: Se encargan exclusivamente de la UI y manipulación del DOM (`src/views/`).
- **Controllers**: Lógica de negocio y orquestación (`src/controllers/`).
- **Observers**: Sistema reactivo a la base de datos Supabase en tiempo real usando EventBus (`src/observers/`).
- **Strategies**: Manejo del modo de juego (Modo Libre vs Modo Carrera competitivo) usando polimorfismo (`src/strategies/`).

## Ejecución Local
Al usar módulos ES6 (`import`/`export`), la aplicación no puede abrirse directamente con el protocolo `file://`. Necesitas levantar un servidor estático.

1. Instalar dependencias locales:
   ```bash
   npm install
   ```
2. Iniciar servidor local:
   ```bash
   npm start
   ```
3. Visitar `http://localhost:5000`

## Variables de Entorno (Supabase)
La app actualmente usa un archivo `src/config.js` que exporta el cliente configurado de Supabase. 
> **Nota de Seguridad**: Si esta aplicación se vuelve un proyecto open-source masivo, se recomienda usar un archivo `.env` o configuraciones en el proceso de build (ej. Rollup/Vite) en lugar de exponer las URLs estáticas en el repositorio. Para proteger la base de datos, las Políticas de Seguridad de Nivel de Fila (RLS) deben configurarse activamente en la consola de Supabase.

## Scripts Adicionales
- Para compilar nuevos marcadores (`targets.mind`), puedes usar la librería oficial de MindAR instalada (`nodegenerator`, en `devDependencies` — es una herramienta de desarrollo, no una dependencia de producción) o usar su interfaz web.

## Seguridad y decisiones de diseño conocidas
- **Participante sin autenticación**: unirse a una carrera solo requiere nombre + código de sesión, por diseño — la meta es una experiencia sin fricción tipo Kahoot. La identidad del participante no está verificada, y así se decidió mantenerlo.
- **Clave de Supabase pública en el repositorio**: `src/config.js` expone la `anon`/`publishable key`. Es el tipo de clave pensada para ser pública; la seguridad real de los datos depende de que las políticas RLS estén bien cerradas (ver `Claude outputs/rls_policies.sql`), no de ocultar esta clave.
- **Cálculo de resultados en el servidor**: desde 2026-09-10, `tiempo_total`/`puntos_total`/`posicion` se calculan en la función de base de datos `finalizar_participante` (ver `Claude outputs/2026-09-10_seguridad_puntajes.sql`) en vez de en el navegador del participante, y el `UPDATE` directo sobre `participantes` quedó restringido a admin. Antes de este cambio, cualquier participante podía en teoría alterar su propio resultado desde la consola del navegador.
- **Duplicados de escaneo**: `escaneos` tiene una restricción única `(participante_id, edificio_id)` a nivel de base de datos (mismo archivo de migración) además del chequeo que ya hacía el cliente, para cerrar la ventana de condición de carrera ante un doble tap o reintento de red.
