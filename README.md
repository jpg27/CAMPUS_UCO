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
- Para compilar nuevos marcadores (`targets.mind`), puedes usar la librería oficial de MindAR instalada o usar su interfaz web.
