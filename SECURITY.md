# 🔒 Guía de Seguridad — Campus UCO

## Credenciales de Supabase

### Estado actual
Las credenciales de Supabase (`SUPABASE_URL` y `SUPABASE_KEY`) se cargan **en tiempo de ejecución** desde `window.SUPABASE_CONFIG` en lugar de estar hardcodeadas en el repo.

### Cómo configurar localmente

#### Opción 1: Inyectar en index.html (desarrollo local)
```html
<!-- ANTES de cargar app.js -->
<script>
  window.SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',
    key: 'your-publishable-key'
  };
</script>
<script type="module" src="./src/app.js"></script>
```

#### Opción 2: Variables de entorno en Vercel (producción)
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_KEY` = tu clave pública
4. Vercel inyectará estas variables en el build

#### Opción 3: Variable de entorno local (desarrollo)
```bash
# .env.local (NO commities este archivo)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-key
```

### ⚠️ Importante
- La clave es "publishable" (pública), pero aún así **no debe estar en el repo**
- Si las credenciales fueron expuestas:
  1. Rotarlas inmediatamente en el dashboard de Supabase
  2. Crear nuevas credenciales
  3. Actualizar la configuración en Vercel

### Row Level Security (RLS)
Se asume que la base de datos usa RLS para proteger datos sensibles. Verifica que:
- `sesiones` solo puede leerse/escribirse por usuarios autorizados
- `participantes` está protegido por participante_id
- `escaneos` está protegido por participante_id y sesion_id
